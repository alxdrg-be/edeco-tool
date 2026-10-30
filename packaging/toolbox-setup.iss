; Inno Setup script for edeco-Toolbox. Build: iscc /DAppVersion=0.2.0 packaging\toolbox-setup.iss
#ifndef AppVersion
  #define AppVersion "0.2.0"
#endif

[Setup]
AppId={{B7A8029D-4CF4-4635-B608-6DA9D63D06B7}
AppName=edeco-Toolbox
AppVersion={#AppVersion}
AppPublisher=edeco
DefaultDirName={localappdata}\Programs\edeco-Toolbox
DefaultGroupName=edeco-Toolbox
DisableProgramGroupPage=yes
; Install per user: no administrator rights needed
PrivilegesRequired=lowest
OutputDir=..\dist-installer
OutputBaseFilename=edeco-Toolbox-Setup-{#AppVersion}
SetupIconFile=toolbox.ico
UninstallDisplayIcon={app}\edeco-Toolbox.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
WizardImageFile=toolbox-wizard-image.png,toolbox-wizard-image-2x.png
WizardSmallImageFile=toolbox-wizard-small.png
WizardImageBackColor=$00927C01
WizardSmallImageBackColor=$00FFFFFF
CloseApplications=yes
RestartApplications=no
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "de"; MessagesFile: "compiler:Languages\German.isl"

[Messages]
SetupWindowTitle=edeco-Toolbox einrichten
WelcomeLabel1=Willkommen
WelcomeLabel2=Dieses Setup installiert edeco-Toolbox auf diesem Computer.%n%nEs werden keine Administratorrechte benötigt. Das Programm liegt im eigenen Benutzerordner.
WizardSelectDir=Zielordner
SelectDirDesc=Wohin soll edeco-Toolbox installiert werden?
SelectDirLabel3=edeco-Toolbox wird in diesen Ordner installiert.
WizardInstalling=Installation
InstallingLabel=edeco-Toolbox wird auf diesem Computer eingerichtet.
FinishedHeadingLabel=edeco-Toolbox ist installiert
FinishedLabel=Das Programm kann jetzt gestartet werden.%n%nDanach lassen sich die Werkzeuge der edeco Toolbox nutzen.
FinishedLabelNoIcons=edeco-Toolbox ist installiert und kann jetzt gestartet werden.
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

[Icons]
Name: "{group}\edeco-Toolbox"; Filename: "{app}\edeco-Toolbox.exe"; IconFilename: "{app}\_internal\packaging\toolbox.ico"
Name: "{userdesktop}\edeco-Toolbox"; Filename: "{app}\edeco-Toolbox.exe"; IconFilename: "{app}\_internal\packaging\toolbox.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\edeco-Toolbox.exe"; Description: "edeco-Toolbox jetzt starten"; Flags: nowait postinstall skipifsilent
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
