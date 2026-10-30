; Inno Setup script for NOVA-Legenden. Build: iscc /DAppVersion=0.1.0 packaging\setup.iss
#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif

[Setup]
AppId={{6C1C3E0B-7E2A-4B8D-9E55-3F1B7A1D4C20}
AppName=NOVA-Legenden
AppVersion={#AppVersion}
AppPublisher=edeco
DefaultDirName={localappdata}\Programs\NOVA-Legenden
DefaultGroupName=NOVA-Legenden
DisableProgramGroupPage=yes
; Install per user: no administrator rights needed
PrivilegesRequired=lowest
OutputDir=..\dist-installer
OutputBaseFilename=NOVA-Legenden-Setup-{#AppVersion}
SetupIconFile=app.ico
UninstallDisplayIcon={app}\NOVA-Legenden.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
WizardImageFile=wizard-image.png,wizard-image-2x.png
WizardSmallImageFile=wizard-small.png
WizardImageBackColor=$00927C01
WizardSmallImageBackColor=$00FFFFFF
CloseApplications=yes
RestartApplications=no
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "de"; MessagesFile: "compiler:Languages\German.isl"

[Messages]
SetupWindowTitle=NOVA-Legenden einrichten
WelcomeLabel1=Willkommen
WelcomeLabel2=Dieses Setup installiert NOVA-Legenden auf diesem Computer.%n%nEs werden keine Administratorrechte benötigt. Das Programm liegt im eigenen Benutzerordner.
WizardSelectDir=Zielordner
SelectDirDesc=Wohin soll NOVA-Legenden installiert werden?
SelectDirLabel3=NOVA-Legenden wird in diesen Ordner installiert.
WizardInstalling=Installation
InstallingLabel=NOVA-Legenden wird auf diesem Computer eingerichtet.
FinishedHeadingLabel=NOVA-Legenden ist installiert
FinishedLabel=Das Programm kann jetzt gestartet werden.%n%nDanach lassen sich elektrische Legenden für Trimble Nova anlegen.
FinishedLabelNoIcons=NOVA-Legenden ist installiert und kann jetzt gestartet werden.
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
Source: "..\dist\NOVA-Legenden\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\NOVA-Legenden"; Filename: "{app}\NOVA-Legenden.exe"
Name: "{userdesktop}\NOVA-Legenden"; Filename: "{app}\NOVA-Legenden.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\NOVA-Legenden.exe"; Description: "NOVA-Legenden jetzt starten"; Flags: nowait postinstall skipifsilent
; After a silent update started from the program: restart it
Filename: "{app}\NOVA-Legenden.exe"; Flags: nowait; Check: WizardSilent

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

procedure CurPageChanged(CurPageID: Integer);
begin
  ApplyBrand;
end;
