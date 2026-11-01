"""Windows process tree containment; assign BEFORE the first instruction runs."""
import ctypes
from ctypes import wintypes as w
import subprocess


class JobProcess:
    def __init__(self, command, *, cwd, env, log):
        k = ctypes.WinDLL('kernel32', use_last_error=True)
        self.k = k
        class STARTUPINFO(ctypes.Structure):
            _fields_ = [('cb', w.DWORD), ('reserved', w.LPWSTR), ('desktop', w.LPWSTR),
                        ('title', w.LPWSTR), ('x', w.DWORD), ('y', w.DWORD),
                        ('xs', w.DWORD), ('ys', w.DWORD), ('xc', w.DWORD), ('yc', w.DWORD),
                        ('fill', w.DWORD), ('flags', w.DWORD), ('show', w.WORD),
                        ('reserved2', w.WORD), ('reserved3', ctypes.c_void_p),
                        ('stdin', w.HANDLE), ('stdout', w.HANDLE), ('stderr', w.HANDLE)]
        class PROCESSINFO(ctypes.Structure):
            _fields_ = [('process', w.HANDLE), ('thread', w.HANDLE), ('pid', w.DWORD), ('tid', w.DWORD)]
        class LIMIT(ctypes.Structure):
            _fields_ = [('perProcess', ctypes.c_int64), ('perJob', ctypes.c_int64),
                        ('flags', w.DWORD), ('minWorking', ctypes.c_size_t),
                        ('maxWorking', ctypes.c_size_t), ('active', w.DWORD),
                        ('affinity', ctypes.c_size_t), ('priority', w.DWORD), ('scheduling', w.DWORD)]
        class IO(ctypes.Structure):
            _fields_ = [(name, ctypes.c_uint64) for name in ('ro', 'wo', 'oo', 'rt', 'wt', 'ot')]
        class EXTENDED(ctypes.Structure):
            _fields_ = [('basic', LIMIT), ('io', IO), ('processMemory', ctypes.c_size_t),
                        ('jobMemory', ctypes.c_size_t), ('peakProcess', ctypes.c_size_t), ('peakJob', ctypes.c_size_t)]
        signatures = {
            'CreateJobObjectW': ([ctypes.c_void_p, w.LPCWSTR], w.HANDLE),
            'SetInformationJobObject': ([w.HANDLE, ctypes.c_int, ctypes.c_void_p, w.DWORD], w.BOOL),
            'AssignProcessToJobObject': ([w.HANDLE, w.HANDLE], w.BOOL),
            'CreateProcessW': ([w.LPCWSTR, w.LPWSTR, ctypes.c_void_p, ctypes.c_void_p, w.BOOL,
                                w.DWORD, ctypes.c_void_p, w.LPCWSTR, ctypes.POINTER(STARTUPINFO), ctypes.POINTER(PROCESSINFO)], w.BOOL),
            'ResumeThread': ([w.HANDLE], w.DWORD),
            'CloseHandle': ([w.HANDLE], w.BOOL),
            'TerminateProcess': ([w.HANDLE, w.UINT], w.BOOL),
            'WaitForSingleObject': ([w.HANDLE, w.DWORD], w.DWORD),
            'GetExitCodeProcess': ([w.HANDLE, ctypes.POINTER(w.DWORD)], w.BOOL),
        }
        for name, (args, result) in signatures.items():
            getattr(k, name).argtypes, getattr(k, name).restype = args, result
        self.job = k.CreateJobObjectW(None, None)
        self.process = None
        if not self.job:
            raise ctypes.WinError(ctypes.get_last_error())
        limits = EXTENDED(); limits.basic.flags = 0x2000  # KILL_ON_JOB_CLOSE
        if not k.SetInformationJobObject(self.job, 9, ctypes.byref(limits), ctypes.sizeof(limits)):
            self.close(); raise ctypes.WinError(ctypes.get_last_error())
        si = STARTUPINFO(); si.cb = ctypes.sizeof(si)
        # Java writes its own log. No inherited handles or console windows.
        pi = PROCESSINFO()
        environment = ctypes.create_unicode_buffer('\0'.join(f'{key}={value}' for key, value in sorted(env.items(), key=lambda p: p[0].upper())) + '\0\0')
        ok = k.CreateProcessW(None, ctypes.create_unicode_buffer(subprocess.list2cmdline(command)),
                              None, None, False, 0x08000004 | 0x400, environment, str(cwd), ctypes.byref(si), ctypes.byref(pi))
        if not ok:
            self.close(); raise ctypes.WinError(ctypes.get_last_error())
        self.process, self.pid = pi.process, pi.pid
        try:
            if not k.AssignProcessToJobObject(self.job, self.process):
                raise ctypes.WinError(ctypes.get_last_error())
            if k.ResumeThread(pi.thread) == 0xFFFFFFFF:
                raise ctypes.WinError(ctypes.get_last_error())
        except BaseException:
            k.TerminateProcess(self.process, 1)
            self.close()
            raise
        finally:
            k.CloseHandle(pi.thread)

    def poll(self):
        code = w.DWORD()
        if not self.k.GetExitCodeProcess(self.process, ctypes.byref(code)):
            raise ctypes.WinError(ctypes.get_last_error())
        return None if code.value == 259 else code.value

    def close(self):
        if self.job:
            self.k.CloseHandle(self.job)
            self.job = None
        if self.process:
            self.k.WaitForSingleObject(self.process, 10000)
            self.k.CloseHandle(self.process)
            self.process = None
