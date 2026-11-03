; Inno Setup script for edeco-Toolbox. Build: iscc /DAppVersion=0.4.0 packaging\toolbox-setup.iss
#ifndef AppVersion
  #define AppVersion "0.5.0"
#endif

[Setup]
AppId={{B7A8029D-4CF4-4635-B608-6DA9D63D06B7}
AppName=edeco Toolhub
AppVersion={#AppVersion}
AppPublisher=edeco
DefaultDirName={localappdata}\Programs\edeco-Toolbox
DefaultGroupName=edeco Toolhub
UsePreviousGroup=no
DisableProgramGroupPage=yes
; Install per user: no administrator rights needed
PrivilegesRequired=lowest
OutputDir=..\dist-installer
OutputBaseFilename=edeco-Toolbox-Setup-{#AppVersion}
SetupIconFile=toolbox.ico
UninstallDisplayIcon={app}\edeco-Toolbox.exe
Compression=lzma2/fast
LZMANumBlockThreads=2
LZMADictionarySize=32768
SolidCompression=yes
DiskSpanning=no
WizardStyle=modern
WizardImageFile=toolbox-wizard-image.bmp,toolbox-wizard-image-2x.bmp
WizardSmallImageFile=toolbox-wizard-small.bmp
WizardImageBackColor=$0038300D
WizardSmallImageBackColor=$00FFFFFF
CloseApplications=yes
RestartApplications=no
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "de"; MessagesFile: "compiler:Languages\German.isl"

[Messages]
SetupWindowTitle=edeco Toolhub einrichten
WelcomeLabel1=Willkommen
WelcomeLabel2=Dieses Setup installiert edeco Toolhub auf diesem Computer.%n%nEs werden keine Administratorrechte benötigt. Das Programm liegt im eigenen Benutzerordner.
WizardSelectDir=Zielordner
SelectDirDesc=Wohin soll edeco Toolhub installiert werden?
SelectDirLabel3=edeco Toolhub wird in diesen Ordner installiert.
WizardInstalling=Installation
InstallingLabel=edeco Toolhub wird auf diesem Computer eingerichtet.
FinishedHeadingLabel=edeco Toolhub ist installiert
FinishedLabel=Das Programm kann jetzt gestartet werden.%n%nDanach lassen sich die Werkzeuge im edeco Toolhub nutzen.
FinishedLabelNoIcons=edeco Toolhub ist installiert und kann jetzt gestartet werden.
StatusClosingApplications=Programme werden geschlossen ...
StatusCreateDirs=Ordner werden angelegt ...
StatusExtractFiles=Dateien werden kopiert ...
StatusCreateIcons=Verknüpfungen werden angelegt ...
StatusSavingUninstall=Deinstallation wird vorbereitet ...
StatusRunProgram=Installation wird abgeschlossen ...
StatusRestartingApplications=Programme werden neu gestartet ...
StatusRollback=Änderungen werden rückgängig gemacht ...

[Tasks]
Name: "desktopicon"; Description: "Symbol auf dem Desktop anlegen"; GroupDescription: "Zusätzliche Symbole:"

[Files]
Source: "..\dist\edeco-Toolbox\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[InstallDelete]
; Remove only the former product shortcuts; user files and install folder stay.
Type: files; Name: "{userdesktop}\edeco-Toolbox.lnk"
Type: files; Name: "{userprograms}\edeco-Toolbox\edeco-Toolbox.lnk"
Type: dirifempty; Name: "{userprograms}\edeco-Toolbox"
Type: filesandordirs; Name: "{app}\_internal\pdf-runtime"

[Icons]
Name: "{group}\edeco Toolhub"; Filename: "{app}\edeco-Toolbox.exe"; IconFilename: "{app}\_internal\packaging\toolbox.ico"
Name: "{userdesktop}\edeco Toolhub"; Filename: "{app}\edeco-Toolbox.exe"; IconFilename: "{app}\_internal\packaging\toolbox.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\edeco-Toolbox.exe"; Description: "edeco Toolhub jetzt starten"; Flags: nowait postinstall skipifsilent
; After a silent update started from the program: restart it
Filename: "{app}\edeco-Toolbox.exe"; Flags: nowait; Check: RestartAfterSilentInstall

[Code]
const
  BrandTeal = $00927C01;
  Ink = $00393020;
  Muted = $007F7564;

procedure ApplyBrand;
begin
  WizardForm.PageNameLabel.Font.Color := Ink;
  WizardForm.PageDescriptionLabel.Font.Color := Muted;
  WizardForm.StatusLabel.Font.Color := Muted;
  WizardForm.FilenameLabel.Font.Color := Muted;
  WizardForm.WelcomeLabel1.Font.Color := BrandTeal;
  WizardForm.FinishedHeadingLabel.Font.Color := BrandTeal;
end;

procedure InitializeWizard;
begin
  ApplyBrand;
end;

function RestartAfterSilentInstall: Boolean;
begin
  Result := WizardSilent and (ExpandConstant('{param:NoAutoRun|0}') <> '1');
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  ApplyBrand;
end;
