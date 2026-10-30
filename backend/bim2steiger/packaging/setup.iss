; iscc /DAppVersion=0.3.1 packaging\setup.iss
#ifndef AppVersion
  #define AppVersion "0.3.1"
#endif

[Setup]
AppId={{B4E8A1C2-6D30-4F77-9A12-8C5E2B7D4A90}
AppName=BIM2STEIGER
AppVersion={#AppVersion}
AppPublisher=edeco AG
DefaultDirName={localappdata}\Programs\BIM2STEIGER
UsePreviousAppDir=no
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist-installer
OutputBaseFilename=BIM2STEIGER-Setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=force
RestartApplications=no
UninstallDisplayName=BIM2STEIGER
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
SetupIconFile=app.ico
UninstallDisplayIcon={app}\BIM2STEIGER.exe

[Languages]
Name: "de"; MessagesFile: "compiler:Languages\German.isl"

[Tasks]
Name: "desktopicon"; Description: "Symbol auf dem Desktop anlegen"; GroupDescription: "Zusätzliche Symbole:"

[Files]
Source: "..\dist\BIM2STEIGER\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\BIM2STEIGER"; Filename: "{app}\BIM2STEIGER.exe"
Name: "{group}\BIM2STEIGER deinstallieren"; Filename: "{uninstallexe}"
Name: "{userdesktop}\BIM2STEIGER"; Filename: "{app}\BIM2STEIGER.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\BIM2STEIGER.exe"; Description: "BIM2STEIGER jetzt starten"; Flags: nowait postinstall skipifsilent

[InstallDelete]
Type: files; Name: "{group}\Steiger2Bim.lnk"
Type: files; Name: "{userdesktop}\Steiger2Bim.lnk"

[Code]
const
  UninstallRegKey = 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{B4E8A1C2-6D30-4F77-9A12-8C5E2B7D4A90}_is1';

function UninstallTarget(const Value: String): String;
var
  Text: String;
  QuotePos: Integer;
begin
  Text := Trim(Value);
  if (Length(Text) >= 2) and (Text[1] = '"') then
  begin
    Delete(Text, 1, 1);
    QuotePos := Pos('"', Text);
    if QuotePos > 0 then
      Text := Copy(Text, 1, QuotePos - 1);
  end
  else
  begin
    QuotePos := Pos(' /', Text);
    if QuotePos > 0 then
      Text := Copy(Text, 1, QuotePos - 1);
  end;
  Result := Trim(Text);
end;

function ForgetMissingInstallation(const Root: Integer): Boolean;
var
  UninstallExe: String;
begin
  Result := False;
  if not RegQueryStringValue(Root, UninstallRegKey, 'UninstallString', UninstallExe) then
    Exit;
  if FileExists(UninstallTarget(UninstallExe)) then
    Exit;
  Result := RegDeleteKeyIncludingSubkeys(Root, UninstallRegKey);
end;

function InitializeSetup(): Boolean;
begin
  { A deleted program folder leaves the Windows entry behind and blocks setup. }
  ForgetMissingInstallation(HKCU);
  ForgetMissingInstallation(HKLM);
  Result := True;
end;
