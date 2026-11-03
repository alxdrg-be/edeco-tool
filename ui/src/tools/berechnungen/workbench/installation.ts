import { withInputRow } from "./inputDiagnostics.ts";
import { InputError, number, integer, type CalculatorDefinition, type Field, type Inputs } from "./types.ts";
import { lookupPublishedIz, publishedAreas, publishedTemperatureFactor, publishedGroupingFactor, lookupPublishedTrayIz, publishedTrayGroupingFactor, publishedHagerBackup, HAGER_BACKUP_REFERENCE, type PublishedHagerFamily, type PublishedIzConfig, type PublishedTrayType, POE_CABLE_REFERENCES, PV_BUY_TARIFFS, PV_FEED_TARIFFS, PV_DIRECTIONS, PV_TILTS, PV_MODULES, publishedMinimumFeedRp, publishedPvGrant } from "./referenceInstallationData.ts";
import { fireCprState, fireCableFact } from "./fireCableData.ts";
import { pvSensitivity } from "./pvAnalysis.ts";
import { NIN_INSTALLATION_METHODS, ninMethodOptions } from './installationMethodChoices.ts';

const source = (file: string) => `https://www.elektro-rechner.ch/Rechner/${file}`;
const n = (key: string, label: string, value: string, unit: string, help: string, group?: string): Field => ({ key, label, default: value, unit, help, group });
const select = (key: string, label: string, value: string, options: [string, string][], help: string): Field => ({ key, label, default: value, kind: "select", options: options.map(([value, label]) => ({ value, label })), help });
function choice(input: Inputs, key: string, options: string[]) { if (!options.includes(input[key])) throw new Error("Bitte eine gültige Auswahl treffen."); return input[key]; }
const lte = (a: number, b: number) => a <= b + 1e-9;
const fmt = (value: number, digits = 3) => value.toLocaleString("de-CH", { maximumFractionDigits: digits });
const sections = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];
function sectionAtLeast(area: number) { const value = sections.find(s => s >= area - 1e-12); if (!value) throw new Error("Benötigter Querschnitt liegt ausserhalb der hinterlegten Standardreihe."); return value; }

const methodOptions: [string,string][] = NIN_INSTALLATION_METHODS.map(({value,label})=>[value,label]);
const onPublished = [{key:"tableMode", values:["published"]}];
const onManual = [{key:"tableMode", values:["manual"]}];
const nin: CalculatorDefinition = {
  id: "nin-kabelrechner", title: "NIN-Kabel · Strombelastbarkeit", description: "Publizierte Cu-Referenzdaten oder manuelle Tabellenwerte mit Korrekturen prüfen.",
  source: source("nin-kabelrechner.html"), scope: "NIN 2025 5.2.3 · Cu-Referenzdaten, Tabellenzuordnung und Projektbedingungen fachlich prüfen",
  fields: [
    select("tableMode","Datengrundlage","published",[["published","Publizierter Cu-Referenzdatensatz"],["manual","Manueller Tabellenwert und Faktoren"]],"Der Datensatz bildet veröffentlichte Zahlen der Referenz ab. Er ersetzt keine Prüfung der zutreffenden Normausgabe und Anwendungsbedingungen."),
    {...select("search","Gesucht","capacity",[["capacity","Strombelastbarkeit aus Querschnitt"],["section","Querschnitt aus Betriebsstrom"]],"Die Querschnittssuche nutzt Iᵦ; die eingegebenen Schutzbedingungen werden zusätzlich separat geprüft."),visibleWhen:onPublished},
    select("conductorKind","Leiter-/Kabelbauart","multi",[["single","Einadrig"],["multi","Mehradrig"],["all","Alle · Bestandsansicht"]],"Grenzt die Verlegearten ein. Beim bewussten Wechsel wird eine entsprechende Verlegeart gewählt; C/D bleiben erhalten. Altstände behalten ihre bisherige Verlegeart in der vollständigen Ansicht."),
    select("method", "Verlegeart", "B2", methodOptions, "D1/D2 benötigen einen manuellen Tabellenwert. Für nicht publizierte Kombinationen wird kein Ersatzwert verwendet."),
    n("area","Gewählter Querschnitt","6","mm²","Standardquerschnitt aus der veröffentlichten Auswahl."),
    select("isolation", "Isolation", "pvc", [["pvc","PVC · 70 °C"],["xlpe","XLPE · 90 °C"]], "Getrennte Datenreihen, kein pauschaler Isolationsfaktor."),
    select("cores", "Belastete Adern", "3", [["2","2 belastete Adern"],["3","3 belastete Adern"]], "Die gewählte Aderzahl bestimmt im Referenzmodus den Tabellenwert."),
    select("parallel", "Parallele Leiter je Phase", "1", [1,2,3,4].map(value=>[String(value),String(value)]), "Identische Leiter mit gleichmässiger Stromaufteilung; im manuellen Modus können gespeicherte Projektwerte weiter geprüft werden."),
    select("arrangement", "Parallelanordnung", "twisted", [["twisted","Verseilt / gemeinsame Kabel"],["unlaid","Unverseilte Einzelleiter"]], "Unverseilte Kupfer-Parallelschaltung unter 70 mm² benötigt eine gesonderte Prüfung nach NIN 5.2.3.7."),
    n("ib","Betriebsstrom Iᵦ","32","A","Bemessungs-Betriebsstrom dieses Stromkreises."), n("in","Schutznennstrom Iₙ","32","A","Nennstrom des zugeordneten Schutzorgans."),
    {...select("ambient","Umgebungs- / Bodentemperatur","30",Array.from({length:15},(_,i)=>10+i*5).map(value=>[String(value),`${value} °C`]),"Luft: Bezug 30 °C; Verlegeart D direkt in Erde: Bezug 20 °C. Nicht publizierte Temperaturkombinationen bleiben gesperrt."),visibleWhen:onPublished},
    {...select("groupingMode","Häufung","none",[["none","Keine Häufung"],["included","Häufung berücksichtigen"]],"Luft: publizierte Reihe für Bündelung; D: direkt in Erde, Kabel berühren sich."),visibleWhen:onPublished},
    {...select("groupCount","Stromkreise in der Gruppe","3",Array.from({length:20},(_,i)=>i+1).map(value=>[String(value),String(value)]),"Die betrachtete Leitung zählt mit. Für D sind maximal sechs wirksame Kreise belegt."),visibleWhen:[...onPublished,{key:"groupingMode",values:["included"]}]},
    {...n("lightlyLoaded","Davon höchstens 30 % belastet","0","Stk.","Nach NIN 5.2.3.5 aus der Häufungszählung ausnehmen; die betrachtete Leitung selbst bleibt enthalten."),visibleWhen:[...onPublished,{key:"groupingMode",values:["included"]}]},
    {...n("iz0","NIN-Tabellenwert Iz₀","50","A","Manuell aus der passenden Norm- oder Herstellergrundlage übernehmen."),visibleWhen:onManual},
    {...n("temperature","Temperaturfaktor kₜ","0.87","","Projektbezogener Faktor aus der zutreffenden Tabelle."),visibleWhen:onManual},
    {...n("grouping","Häufungsfaktor kₕ","0.8","","Faktor für die konkrete Anordnung; keine automatische Ableitung im manuellen Modus."),visibleWhen:onManual},
    n("i2factor","Prüfstromfaktor I₂/Iₙ","1.45","","Grossen Prüfstrom des konkreten Schutzorgans aus dessen Datenblatt übernehmen."),
  ],
  calculate(input) {
    const tableMode=choice(input,"tableMode",["published","manual"]), method=choice(input,"method",methodOptions.map(item=>item[0]));
    const conductorKind=input.conductorKind??'all';
    if(!ninMethodOptions(conductorKind).some(option=>option.value===method))throw Error('Die Verlegeart passt nicht zur gewählten Leiter-/Kabelbauart. Passende Verlegeart oder vollständige Bestandsansicht wählen.');
    const ib=number(input,"ib","Betriebsstrom",0,10000), rated=number(input,"in","Schutznennstrom",0,10000), factor=number(input,"i2factor","Prüfstromfaktor",0,10);
    const isolation=choice(input,"isolation",["pvc","xlpe"]) as "pvc"|"xlpe", cores=Number(choice(input,"cores",["2","3"])) as 2|3;
    const parallel=integer(input,"parallel","Parallele Leiter",0,tableMode==="published"?4:50), arrangement=choice(input,"arrangement",["twisted","unlaid"]);
    const config: PublishedIzConfig={material:"cu",isolation,cores,method};
    const search=tableMode==="published"?choice(input,"search",["capacity","section"]):"capacity";
    let area=search==="capacity"?number(input,"area","Querschnitt",0,630):0, base:number, kt:number, kh:number, effectiveCount=1, ambient:number|null=null;
    if(tableMode==="manual") {
      base=number(input,"iz0","Tabellenwert",0,20000); kt=number(input,"temperature","Temperaturfaktor",0,2); kh=number(input,"grouping","Häufungsfaktor",0,1);
    } else {
      ambient=number(input,"ambient","Umgebungstemperatur",0,80);
      const temp=publishedTemperatureFactor(isolation,ambient,method);
      if(temp===null)throw new Error("Für diese Temperatur und Verlegeart ist kein Referenzfaktor hinterlegt. Manuelle belegte Faktoren verwenden.");
      kt=temp;
      const grouped=choice(input,"groupingMode",["none","included"])==="included";
      if(grouped) {
        const count=integer(input,"groupCount","Gehäufte Stromkreise",0,20), light=integer(input,"lightlyLoaded","Leicht belastete Stromkreise",0,count-1,true);
        effectiveCount=count-light;
      }
      const grouping=publishedGroupingFactor(effectiveCount,method);
      if(grouping===null)throw new Error("Für diese Anzahl wirksamer Stromkreise ist kein Häufungsfaktor belegt. Manuelle Projektgrundlage verwenden.");
      kh=grouping;
      if(search==="section") {
        const found=publishedAreas(config).find(a=>lookupPublishedIz({...config,area:a})!*kt*kh*parallel>=ib-1e-9);
        if(found===undefined)throw new Error("Kein ausreichender Querschnitt im belegten Referenzbereich. Eingaben oder manuelle Projektgrundlage prüfen.");
        area=found;
      }
      const ref=lookupPublishedIz({...config,area});
      if(ref===null)throw new Error("Für Querschnitt, Verlegeart und Aderzahl ist kein Referenzwert hinterlegt. Kein Ersatzwert berechnet.");
      base=ref;
    }
    if(!sections.includes(area))throw new Error("Einen Standardquerschnitt wählen.");
    const izEach=base*kt*kh, iz=izEach*parallel, i2=rated*factor, overload=lte(ib,rated)&&lte(rated,iz)&&lte(i2,1.45*iz), parallelWarning=parallel>1&&area<70&&arrangement==="unlaid";
    const comparison=tableMode==="published"?methodOptions.filter(item=>lookupPublishedIz({...config,method:item[0],area})!==null).map(([name])=>{
      const temp=publishedTemperatureFactor(isolation,ambient!,name), group=publishedGroupingFactor(effectiveCount,name), ref=lookupPublishedIz({...config,method:name,area});
      return {label:`Verlegeart ${name} · ${fmt(area)} mm²`,value:temp===null||group===null?"kein Faktor":`${fmt(ref!*temp*group*parallel,1)} A`};
    }):[];
    return {
      metrics:[{label:"Korrigierte Strombelastbarkeit Iz",value:iz,unit:"A",digits:1,tone:overload?"ok":"error"},{label:search==="section"?"Gefundener Querschnitt":"Referenzwert Iz₀",value:search==="section"?area:base,unit:search==="section"?"mm²":"A",digits:1},{label:"Reserve Iz − Iₙ",value:iz-rated,unit:"A",digits:1}],
      status:{tone:!overload?"error":parallelWarning?"warning":"ok",text:!overload?"Mindestens eine Überlastbedingung ist nicht erfüllt.":parallelWarning?"NIN 5.2.3.7: unverseilte Kupfer-Parallelschaltung unter 70 mm² gesondert prüfen.":"Die Zahlenbedingungen der Überlastprüfung sind erfüllt; Anwendungsbedingungen der Datenbasis prüfen."},
      formula:`Iz = Iz₀ × kₜ × kₕ × n = ${fmt(base)} × ${fmt(kt)} × ${fmt(kh)} × ${parallel} = ${fmt(iz)} A; Iᵦ ≤ Iₙ ≤ Iz: ${fmt(ib)} ≤ ${fmt(rated)} ≤ ${fmt(iz)} A; I₂ = ${fmt(factor)} × ${fmt(rated)} = ${fmt(i2)} A ≤ 1.45 × ${fmt(iz)} = ${fmt(1.45*iz)} A`,
      rows:[{label:"Datenbasis",value:tableMode==="published"?"Publizierter Cu-Referenzdatensatz · 01.11.2026":"Manuelle Norm-/Projektwerte"},{label:"Verlegeart / Querschnitt",value:`${method} / ${fmt(area)} mm²`},{label:"Isolation / belastete Adern",value:`${isolation==="pvc"?"PVC":"XLPE"} / ${cores}`},{label:"Wirksame Häufungszahl",value:tableMode==="published"?effectiveCount:"im manuellen Faktor dokumentiert"},{label:"k_temp / k_Häufung",value:`${fmt(kt)} / ${fmt(kh)}`},{label:"Iz je parallelem Kreis",value:izEach,unit:"A"},...comparison],
      series:[{label:"Betriebsstrom",value:ib},{label:"Schutzorgan",value:rated},{label:"Strombelastbarkeit",value:iz}],seriesLabel:"Überlastbedingungen",seriesUnit:"A",
      limitations:["Der Referenzdatensatz ist ein nachvollziehbarer Stand veröffentlichter Zahlen. Die Werte müssen NIN 2025 5.2.3 entsprechen; passende Normausgabe, Verlegebedingungen und Tabelle am Projekt prüfen. Keine Interpolation oder erfundene Ersatzwerte.","Die Querschnittssuche berücksichtigt nur den eingegebenen Betriebsstrom und die genannten Korrekturen. Schutzbedingungen, Spannungsfall, Abschaltzeit, Kurzschlussfestigkeit und PE sind getrennt zu beurteilen."],
    };
  },
};

const ampacity: CalculatorDefinition = {
  id:"strombelastbarkeit",title:"Zuleitung · Strombelastbarkeit",description:"PVC, XLPE und CFW auf gelochter Wanne mit nachvollziehbaren Korrekturen vergleichen.",source:source("Strombelastbarkeit.html"),scope:"NIN 2025 5.2.3 · E/F für PVC/XLPE; CFW als veröffentlichter Herstelleransatz",
  fields:[
    select("tableMode","Datengrundlage","published",[["published","Publizierte Tabellen-/Häufungswerte"],["manual","Manuelle Projektwerte"]],"Die Tabellenwerte sind ein veröffentlichter Referenzstand, keine allgemeine Herstellerfreigabe."),
    {...select("type","Kabel-/Isolationsansatz","xlpe",[["xlpe","XLPE Cu · 90 °C"],["pvc","PVC Cu · 70 °C"],["cfw","CFW PowerCable · Referenzansatz"]],"Für CFW werden nur die publizierten 30-°C-Wannenwerte mit berührender Parallelverlegung verwendet."),visibleWhen:onPublished},
    select("method","Verlegeart auf gelochter Wanne","F",[["E","E · Mehrleiterkabel"],["F","F · Einzelleiter im Dreieck"]],"Drei belastete Adern, gelochte Kabelwanne; der Tabellenwert folgt im Referenzmodus der Auswahl."),
    select("area","Leiterquerschnitt","95",sections.map(value=>[String(value),`${fmt(value)} mm²`]),"Standardquerschnitt des betrachteten Kupferleiters."),
    {...select("ambient","Umgebungstemperatur","30",Array.from({length:11},(_,i)=>10+i*5).map(value=>[String(value),`${value} °C`]),"Bezug Luft 30 °C. Bei CFW ist in diesem Referenzpfad nur 30 °C hinterlegt."),visibleWhen:onPublished},
    {...n("base","Tabellenwert je Stromkreis Iz₀","220","A","Manueller NIN- oder Herstellerwert passend zu Verlegeart und Querschnitt."),visibleWhen:onManual},
    {...n("temperature","Temperaturfaktor","1","","Projektfaktor aus passender Tabelle; wird tatsächlich in die Rechnung eingesetzt."),visibleWhen:onManual},
    {...n("grouping","Häufungsfaktor","0.85","","Manueller Faktor für die konkrete Anordnung."),visibleWhen:onManual},
    select("circuits","Parallele Stromkreise","1",[1,2,3,4].map(value=>[String(value),String(value)]),"Identische Leiter und gleichmässige Stromaufteilung. Der Referenzmodus enthält Faktoren für ein bis vier Kreise."),
    n("load","Gesamt-Betriebsstrom","250","A","Gesamtstrom, der gleichmässig auf die parallelen Kreise verteilt wird."),
  ],
  calculate(input) {
    const mode=choice(input,"tableMode",["published","manual"]), method=choice(input,"method",["E","F"]) as "E"|"F";
    const area=number(input,"area","Leiterquerschnitt",0,630), count=integer(input,"circuits","Parallele Stromkreise",0,mode==="published"?4:50),load=number(input,"load","Gesamt-Betriebsstrom",0,100000);
    if(!sections.includes(area))throw new Error("Einen Standardquerschnitt wählen.");
    let base:number,kt:number,kh:number,type:PublishedTrayType|null=null;
    if(mode==="manual") {
      base=number(input,"base","Tabellenwert",0,20000);kt=number(input,"temperature","Temperaturfaktor",0,2);kh=number(input,"grouping","Häufungsfaktor",0,1);
    } else {
      type=choice(input,"type",["pvc","xlpe","cfw"]) as PublishedTrayType;
      const reference=lookupPublishedTrayIz(type,method,area), grouping=publishedTrayGroupingFactor(type,count),ambient=number(input,"ambient","Umgebungstemperatur",0,60);
      if(reference===null||grouping===null)throw new Error("Für diese Kabel-/Querschnitts-/Parallelkombination ist kein Referenzwert hinterlegt.");
      const temperature=type==="cfw"?(ambient===30?1:null):publishedTemperatureFactor(type,ambient,method);
      if(temperature===null)throw new Error("Für diese Temperatur ist im gewählten Referenzpfad kein Faktor belegt; manuelle Projektwerte verwenden.");
      base=reference;kt=temperature;kh=grouping;
    }
    const each=base*kt*kh,total=each*count,share=load/count,ok=lte(load,total);
    return {
      metrics:[{label:"Gesamt-Iz",value:total,unit:"A",digits:1,tone:ok?"ok":"error"},{label:"Iz je Stromkreis",value:each,unit:"A",digits:1},{label:"Betriebsstrom je Kreis",value:share,unit:"A",digits:1},{label:"Auslastung",value:load/total*100,unit:"%",digits:1}],
      status:{tone:ok?"ok":"error",text:ok?"Gesamt-Betriebsstrom liegt unter der berechneten Strombelastbarkeit.":"Betriebsstrom überschreitet die berechnete Strombelastbarkeit."},
      formula:`Iz,Kreis = Iz₀ × k_temp × k_Häufung = ${fmt(base)} × ${fmt(kt)} × ${fmt(kh)} = ${fmt(each)} A; Iz,gesamt = ${count} × ${fmt(each)} = ${fmt(total)} A; I,Kreis = ${fmt(load)} / ${count} = ${fmt(share)} A (${method}, ${fmt(area)} mm²)`,
      rows:[{label:"Datenbasis",value:mode==="manual"?"Manuelle Projektwerte":type==="cfw"?"CFW-Referenzansatz · Luft 30 °C, berührend":"Publizierte Cu-/NIN-Referenzdaten"},{label:"Tabellenwert je Kreis",value:base,unit:"A"},{label:"Temperaturfaktor",value:kt},{label:"Häufungsfaktor",value:kh}],
      series:[{label:"Gesamt-Betriebsstrom",value:load},{label:"Gesamt-Iz",value:total}],seriesLabel:"Zuleitungsbudget",seriesUnit:"A",
      limitations:["PVC/XLPE beziehen sich auf den veröffentlichten NIN-Referenzstand; CFW auf publizierte Herstelleransätze. Passende Normausgabe, Kabelausführung, Temperatur und Anordnung am Projekt prüfen.","Identische Leiter mit gleicher Stromaufteilung werden vorausgesetzt. Schutzorgane, Anschlüsse, Spannungsfall und Kurzschlussfestigkeit bleiben getrennte Nachweise. Es wird vor der Summierung nicht auf ganze Ampere gerundet."],
    };
  },
};

const breaker: CalculatorDefinition = {
  id:"ls-schalter",title:"LS-Schalter · Schutzprüfung",description:"Vorsicherung, LS, Fehlerstrom und Stromkreisart nachvollziehbar prüfen.",source:source("ls-schalter.html"),scope:"IEC 60898-1 · K/Z: IEC 60947-2 / Herstellerannahme · NIN 4.3 / 5.3.3, TN-Vorprüfung",
  fields:[
    select("curve","Charakteristik","B",[["B","B · 3–5 × Iₙ"],["C","C · 5–10 × Iₙ"],["D","D · 10–20 × Iₙ"],["K","K · 8–14 × Iₙ · Herstellerannahme"],["Z","Z · 2–3 × Iₙ · Herstellerannahme"]],"K/Z-Werte sind Herstellerannahmen; die konkrete Kennlinie muss bestätigt werden."),
    select("upstreamType","Vorgeschaltetes Schutzorgan","nh",[["nh","NH gG"],["ls","LS · Charakteristik B"]],"Die Geräteart wird ausdrücklich gewählt, nicht aus dem Nennstrom erraten."),
    select("upstream","Vorsicherungs-Nennstrom","125",[10,13,16,20,25,32,35,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000].map(value=>[String(value),`${value} A`]),"Keine automatische Herstellerkoordination aus dem Nennstrom."),
    n("rated","LS-Nennstrom Iₙ","16","A","Nennstrom des LS-Schalters."),n("load","Betriebsstrom Iᵦ","13","A","Maximaler Betriebsstrom des Stromkreises."),n("iz","Korrigierte Strombelastbarkeit Iz","20","A","Bereits inklusive aller Korrekturfaktoren ermittelter Wert."),
    n("icn","Ausschaltvermögen Icn","6","kA","Gerätewert; eine Backup-Erweiterung setzt dokumentierte Koordinationsdaten voraus."),n("ikMax","Max. Kurzschlussstrom","5","kA","Prospektiver Strom an der Einbaustelle."),n("ikMin","Min. Fehlerstrom am Leitungsende","120","A","Projektbezogen belegter Mindestfehlerstrom."),n("i2factor","Prüfstromfaktor I₂/Iₙ","1.45","","Wert des konkreten Geräts."),
    select("circuitType","Stromkreisart","socket",[["socket","Endstromkreis mit Steckdosen"],["fixed","Nur fest angeschlossene Verbraucher"],["distribution","Verteilungsstromkreis"]],"Publizierter TN-Schnellansatz: 0.4 s für Steckdosen bis 63 A beziehungsweise feste Verbraucher bis 32 A, sonst 5 s. Verbindliche Abschaltzeit und Kennlinie am Projekt bestätigen."),
    select("backupMode","Hersteller-Backup-Daten","none",[["none","Keine belegte Koordination"],["reference","Publizierten Hager-Referenzwert vergleichen"],["documented","Dokumentierte NH-/LS-Koordination eingeben"]],"Der Hager-Referenzvergleich ist auf benannte Gerätefamilien beschränkt und bleibt ohne Originalnachweis unverifiziert. Eine manuelle Koordination muss genau zu den Geräten passen."),
    {...select("backupFamily","Hager-Gerätefamilie · Referenzvergleich","standard6",[["standard6","MBN/MCN · B/C · 6 kA"],["high10","NBN/NCN/NDN · B/C/D · 10–25 kA"]],"Nur die ausdrücklich gewählte Familie, Kennlinie, Icn-Klasse und LS bis 63 A. Die Veröffentlichung des Anbieters ersetzt keine passende Original-Herstellerkoordination."),visibleWhen:[{key:"backupMode",values:["reference"]}]},
    {...n("backupLimit","Dokumentierte Backup-Grenze","25","kA","Nachgewiesene Koordinationsgrenze für die eingegebenen Geräte."),visibleWhen:[{key:"backupMode",values:["documented"]}]},
    {...{key:"backupReference",label:"Hersteller / Baureihe / Fundstelle",default:"",kind:"text" as const,help:"Die dokumentierte Kombination und Gültigkeitsbedingungen vollständig benennen."},visibleWhen:[{key:"backupMode",values:["documented"]}]},
  ],
  calculate(input) {
    const curve=choice(input,"curve",["B","C","D","K","Z"]),ranges:Record<string,[number,number]>={B:[3,5],C:[5,10],D:[10,20],K:[8,14],Z:[2,3]},[low,high]=ranges[curve];
    const rated=number(input,"rated","LS-Nennstrom",0,2000),load=number(input,"load","Betriebsstrom",0,10000),iz=number(input,"iz","Strombelastbarkeit",0,20000),icn=number(input,"icn","Ausschaltvermögen",0,200),max=number(input,"ikMax","Maximaler Kurzschlussstrom",0,200),min=number(input,"ikMin","Minimaler Fehlerstrom",0,200000),i2factor=number(input,"i2factor","Prüfstromfaktor",0,10);
    const upstreamType=choice(input,"upstreamType",["nh","ls"]),upstream=number(input,"upstream","Vorsicherung",0,2000),circuit=choice(input,"circuitType",["socket","fixed","distribution"]),backupMode=choice(input,"backupMode",["none","reference","documented"]),documented=backupMode==="documented";
    if(min>max*1000)throw new Error("Minimaler Fehlerstrom darf den maximalen Kurzschlussstrom nicht überschreiten.");
    let backup:number|null=null;
    if(documented) {
      if(upstreamType!=="nh")throw new Error("Die eingegebene Backup-Grenze gilt in diesem Modell nur für eine dokumentierte NH-/LS-Kombination.");
      backup=number(input,"backupLimit","Dokumentierte Backup-Grenze",0,200);
      if(!(input.backupReference??"").trim())throw new Error("Hersteller, Baureihe und Fundstelle der Koordination eingeben.");
    }
    if(backupMode==="reference") {
      const family=choice(input,"backupFamily",["standard6","high10"]) as PublishedHagerFamily;
      if(upstreamType!=="nh")throw new Error("Der publizierte Hager-Backup-Vergleich benötigt eine NH-gG-Vorsicherung.");
      backup=publishedHagerBackup(family,curve,rated,upstream,icn);
      if(backup===null)throw new Error("Kein publizierter Backup-Wert für diese Gerätefamilie, Kennlinie, LS-Grösse, Icn-Klasse oder NH-Grösse. Keine Ersatzgrenze berechnet.");
    }
    const overload=lte(load,rated)&&lte(rated,iz)&&lte(i2factor*rated,1.45*iz),effectiveCapacity=Math.max(icn,backup??0),breaking=lte(max,effectiveCapacity);
    const magneticPossible=lte(rated*low,min),magneticFast=lte(rated*high,min),fastRequired=circuit==="socket"&&rated<=63||circuit==="fixed"&&rated<=32,period=fastRequired?.4:5;
    const okay=overload&&breaking&&magneticFast,conditionalBackup=icn<max&&backup!==null,kz=["K","Z"].includes(curve);
    const tone=!overload||!breaking?"error":!magneticFast||conditionalBackup||kz||backupMode==="reference"?"warning":"ok";
    return {
      metrics:[{label:"Magnetischer Auslösebereich",value:`${fmt(low*rated,1)}–${fmt(high*rated,1)}`,unit:"A"},{label:"Ausschaltreserve",value:effectiveCapacity-max,unit:"kA",digits:2,tone:breaking?"ok":"error"},{label:"Reserve zum oberen Magnetauslöser",value:min-high*rated,unit:"A",digits:1,tone:magneticFast?"ok":"warning"}],
      rows:[{label:"Vorsicherung",value:`${upstreamType==="nh"?"NH gG":"LS B"} ${fmt(upstream)} A`},{label:"NH-Backup",value:backup===null?"Kein belegter Backup-Wert":`${fmt(backup)} kA · ${backupMode==="reference"?`${input.backupFamily} · ${HAGER_BACKUP_REFERENCE.attribution}`:input.backupReference.trim()}`},{label:"LS–LS",value:"Ohne Herstellerkennlinie nicht nachgewiesen"},{label:"Überlastbedingungen",value:overload?"erfüllt":"nicht erfüllt"},{label:backupMode==="reference"?"Ausschaltvermögen / Referenz-Backup":"Ausschaltvermögen / dokumentiertes Backup",value:breaking?"Zahlenbedingung erfüllt":"nicht erfüllt"},{label:"Magnetisches Ansprechen möglich",value:magneticPossible?`ab ${fmt(low*rated)} A erreicht`:`${fmt(low*rated)} A nicht erreicht`},{label:"Abschaltzeit · TN-Planungsansatz",value:`${fmt(period)} s · ${fastRequired?"oberer Magnetauslöser erforderlich":"Herstellerkennlinie für 5-s-Aussage erforderlich"}`},{label:"Ik,min ≥ oberer Magnetauslöser",value:magneticFast?"erfüllt":"nicht erfüllt"}],
      status:{tone,text:backupMode==="reference"&&overload&&breaking?"Zahlenvergleich mit publiziertem Hager-Referenzwert; Original-Herstellerkoordination und konkrete Gerätezuordnung bleiben zu bestätigen.":kz&&overload&&breaking?"K/Z-Auslösebereich als Herstellerannahme; Kennlinie am konkreten Gerät bestätigen.":conditionalBackup&&overload?"Ausschaltbedingung verwendet die manuell dokumentierte NH-/LS-Koordination; Gültigkeit der Herstellerdaten bestätigen.":okay?"Die geprüften Zahlenbedingungen sind erfüllt; Selektivität und vollständiges Schutzkonzept separat beurteilen.":"Mindestens eine Vorprüfung ist nicht erfüllt oder benötigt die konkrete Herstellerkennlinie."},
      formula:`Iᵦ ≤ Iₙ ≤ Iz: ${fmt(load)} ≤ ${fmt(rated)} ≤ ${fmt(iz)} A; I₂ = ${fmt(i2factor)} × ${fmt(rated)} = ${fmt(i2factor*rated)} A ≤ ${fmt(1.45*iz)} A; Icn${backup!==null?(backupMode==="reference"?" / Referenz-Backup":" / dokumentiertes Backup"):""} ≥ Ik,max: ${fmt(effectiveCapacity)} ≥ ${fmt(max)} kA; ${curve}: ${low}–${high} × ${fmt(rated)} = ${fmt(low*rated)}–${fmt(high*rated)} A; TN-Zeitansatz ${fmt(period)} s`,
      diagram:{kind:"chain",nodes:[{label:"Netz",value:`${fmt(max)} kA`,detail:"Ik,max"},{label:`Vorsicherung ${upstreamType==="nh"?"NH gG":"LS B"}`,value:`${fmt(upstream)} A`,detail:backup===null?"Koordination unbelegt":`${fmt(backup)} kA ${backupMode==="reference"?"Referenzwert":"dokumentiert"}`},{label:`LS ${curve}${fmt(rated)}`,value:`${fmt(icn)} kA`,detail:"Geräte-Ausschaltvermögen",tone:breaking?"ok":"error"},{label:"Leitungsende",value:`${fmt(min)} A`,detail:`TN-Zeitansatz ${fmt(period)} s`,tone:magneticFast?"ok":"warning"}]},
      limitations:["Auslösebereiche und Zeitansatz sind eine TN-Vorprüfung. Ein Strom über der unteren magnetischen Grenze garantiert keine konkrete Abschaltzeit; dafür sind Netzsystem, Stromkreis und Herstellerkennlinie massgebend.","Kein Selektivitätsnachweis aus Nennstromstaffelung. Ein Hager-Referenzwert ist eine publizierte Anbietertranskription, kein unabhängig geprüfter Originalnachweis. Der Referenzmodus bleibt als Vorvergleich gekennzeichnet und extrapoliert weder über LS 63 A noch auf andere Gerätefamilien. K/Z-Werte und manuell eingegebene Backup-Grenzen sind gerätebezogene Annahmen beziehungsweise Benutzerdaten."],
    };
  },
};

const bonding: CalculatorDefinition = {
  id:"potenzialausgleich",title:"Potenzialausgleich",description:"Phasen-/Schutzleiter mit publizierter Zuordnung oder manuell belegten PA-Werten prüfen.",source:source("potenzialausgleich.html"),scope:"NIN 2025 5.4.3 / 5.4.4 · Cu, publizierter Referenzbereich oder manuelle Projektwerte",
  fields:[
    select("paMode","Datengrundlage","published",[["published","Publizierte Zuordnung aus Phasenquerschnitt"],["manual","Manuelle PE-/HPA-Werte"]],"Die automatische Zuordnung ist auf den publizierten Cu-Bereich beschränkt und am Projekt fachlich zu bestätigen."),
    {...select("phase","Phasenleiter der Zuleitung","16",[4,6,10,16,25,35,50,70,95,120].map(value=>[String(value),`${value} mm² Cu`]),"Phasenquerschnitt für die veröffentlichte PE-/HPA-Zuordnung."),visibleWhen:[{key:"paMode",values:["published"]}]},
    {...select("pen","Vorhandener PEN / Schutzleiter","16",[4,6,10,16,25,35,50,70,95,120].map(value=>[String(value),`${value} mm² Cu`]),"Wird mit dem aus dem Phasenquerschnitt berechneten Mindest-PE verglichen."),visibleWhen:[{key:"paMode",values:["published"]}]},
    {...select("epa","EPA Erdungsanschluss","0",[0,4,6,10,16,25].map(value=>[String(value),value===0?"Kein EPA":`${value} mm² Cu`]),"Dokumentation eines vorhandenen Anschlusses; dieser Wert ändert HPA/PE nicht automatisch."),visibleWhen:[{key:"paMode",values:["published"]}]},
    {...n("pe","PE des Betriebsmittels / kleinerer PE","16","mm²","Manuell belegter PE des Betriebsmittels, nicht automatisch der Zuleitungs-PE."),visibleWhen:[{key:"paMode",values:["manual"]}]},
    {...n("hpaTable","HPA aus NIN-Tabelle","10","mm²","Projektwert aus der zutreffenden Tabelle, ohne pauschalen universellen Deckel."),visibleWhen:[{key:"paMode",values:["manual"]}]},
    select("lps","Äusserer Blitzschutz","no",[["no","Nicht vorhanden"],["yes","Vorhanden"]],"Im publizierten Modell HPA mindestens 10 mm² Cu mit LPS. Die Forderung wird nicht pauschal auf den zusätzlichen PA übertragen."),
    select("connection","Zusätzlicher PA verbindet","foreign",[["foreign","Körper mit fremdem leitfähigem Teil"],["bodies","Zwei Körper"]],"Zum fremden leitfähigen Teil halber PE, zwischen zwei Körpern voller kleinerer PE; konkreten Anwendungsfall fachlich bestätigen."),
    {...n("minimum","Projektminimum zusätzlicher PA","4","mm²","Mindestquerschnitt entsprechend mechanischem Schutz und Anwendung."),visibleWhen:[{key:"paMode",values:["manual"]}]},
  ],
  calculate(input) {
    const mode=choice(input,"paMode",["published","manual"]),lps=choice(input,"lps",["yes","no"]),connection=choice(input,"connection",["foreign","bodies"]);
    let pe:number,table:number,minimum:number,phase:number|null=null,pen:number|null=null,epa:number|null=null;
    if(mode==="manual") { pe=number(input,"pe","Schutzleiter",0,630);table=number(input,"hpaTable","HPA-Tabellenwert",0,630);minimum=number(input,"minimum","Projektminimum",0,630); }
    else {
      phase=number(input,"phase","Phasenleiter",0,120);pen=number(input,"pen","PEN / Schutzleiter",0,120);epa=number(input,"epa","EPA",0,25,true);
      if(![4,6,10,16,25,35,50,70,95,120].includes(phase)||![4,6,10,16,25,35,50,70,95,120].includes(pen)||![0,4,6,10,16,25].includes(epa))throw new Error("Einen publizierten Phasen-/PEN-/EPA-Querschnitt wählen.");
      pe=phase<=16?phase:phase<=35?16:sectionAtLeast(phase/2);table=phase<=10?6:phase<=35?10:16;minimum=4;
    }
    const floor=lps==="yes"?10:6,hpa=sectionAtLeast(Math.max(floor,table)),calculated=connection==="foreign"?pe/2:pe,extra=sectionAtLeast(Math.max(minimum,calculated)),fe=Math.max(4,hpa),penSmall=pen!==null&&pen<pe;
    return {
      metrics:[{label:"Haupt-PA aus den Eingaben",value:hpa,unit:"mm² Cu"},{label:"Zusätzlicher PA",value:extra,unit:"mm² Cu"},{label:"Massgebender Schutzleiter PE",value:pe,unit:"mm² Cu"},{label:"Funktionserdung · Referenzansatz",value:fe,unit:"mm² Cu"}],
      rows:[{label:"Datenbasis",value:mode==="published"?"Publizierte Cu-Zuordnung im eingegrenzten Referenzbereich":"Manuelle Norm-/Projektwerte"},{label:"Phasenleiter / vorhandener PEN",value:phase===null?"manuell":`${fmt(phase)} / ${fmt(pen!)} mm² Cu`},{label:"EPA · nur Dokumentation",value:epa===null?"manuell":epa===0?"kein EPA":`${fmt(epa)} mm² Cu`},{label:"HPA-Mindestansatz",value:floor,unit:"mm² Cu"},{label:"ÖPA vor Rundung",value:Math.max(minimum,calculated),unit:"mm² Cu"}],
      status:{tone:penSmall?"warning":"neutral",text:penSmall?`Vorhandener PEN ${fmt(pen!)} mm² liegt unter dem berechneten PE ${fmt(pe)} mm². Zuleitung prüfen.`:"PA-Querschnitte im gewählten Modell berechnet; normgerechte Zuordnung und Ausführung am Projekt prüfen."},
      formula:`${phase===null?`PE = ${fmt(pe)} mm² (manuell)`:`PE(${fmt(phase)} mm² Phase) = ${fmt(pe)} mm² Cu`}; HPA = nächster Standard ≥ max(Tabellenansatz, LPS-Minimum) = nächster Standard ≥ max(${fmt(table)}, ${fmt(floor)}) = ${fmt(hpa)} mm² Cu; ÖPA = nächster Standard ≥ max(${fmt(minimum)}, ${connection==="foreign"?`${fmt(pe)}/2`:fmt(pe)}) = ${fmt(extra)} mm² Cu; FE = max(4, HPA) = ${fmt(fe)} mm² Cu`,
      series:[{label:"HPA",value:hpa},{label:"PE",value:pe},{label:"ÖPA",value:extra},{label:"FE · Ansatz",value:fe}],seriesLabel:"Kupferquerschnitte",seriesUnit:"mm²",
      limitations:["Die automatische Stufenzuordnung ist nur für die publizierten Cu-Werte 4–120 mm² verfügbar. Der HPA-Ansatz über den Aussenleiter und der FE-Ansatz bilden Referenzverhalten ab; passende NIN-Tabelle, Schutzorgan und Anwendungsfall am Projekt bestätigen.","Der zusätzliche PA verwendet im Referenzmodus den berechneten Zuleitungs-PE; im manuellen Modus kann der tatsächlich massgebende Betriebsmittel-PE eingetragen werden. EPA ist eine Dokumentationsangabe. Keine Auslegung von Erdungsanlage, Anschlussstellen oder Blitzstromtragfähigkeit."],
    };
  },
};

const pv: CalculatorDefinition = {
  id:"pva-rechner",title:"PV-Anlage · Ertrag & Wirtschaftlichkeit",description:"Dach-/Modulplanung, Bestand, Tarifreferenzen, Speicher und Wirtschaftlichkeit vergleichen.",source:source("pva-rechner.html"),scope:"Planungsannahmen · Referenzdaten 2026; EnV Art. 12 nur beim datierten Minimalvergütungsansatz",
  fields:[
    select("sizing","Anlagenansatz","modules",[["modules","Neue Anlage · ganze Module"],["existing","Bestandesanlage bewerten"],["power","Installierte Leistung direkt"],["area","Kontinuierlicher Flächenansatz"]],"Ganze Module werden abgerundet. Der kontinuierliche Flächenansatz bleibt für frühere Projektstände erhalten."),
    select("roof","Dach-/Lageansatz","flat",[["flat","Flachdach · publizierte Annahmen"],["pitched","Schrägdach · publizierte Annahmen"],["manual","Eigene Belegung und Lagefaktoren"]],"Referenzannahme: Flachdach 62 % belegbar / Lagefaktor 0.93, Schrägdach 90 % belegbar. Keine aktuelle PVGIS-Abfrage."),
    select("modulePreset","Modulansatz","22.5-1.95",[...PV_MODULES.map(module=>[module.id,`${fmt(module.efficiency)} % · ${fmt(module.area)} m² · ${fmt(module.efficiency*module.area*10)} Wp`] as [string,string]),["manual","Eigene Modulfläche / Wirkungsgrad"]],"Technische Referenzparameter, keine Herstellerdatenbank."),
    n("moduleArea","Fläche je Modul","1.95","m²","Technischer Modulansatz aus dem Datenblatt."),n("efficiency","Modulwirkungsgrad","22.5","%","STC-Modulwirkungsgrad aus dem Datenblatt."),
    n("power","Installierte Anlagenleistung","10","kWp","Direkte Typenschild-/Planungseingabe."),n("area","Dachfläche","200","m²","Geometrische Dachfläche vor dem Belegungsansatz."),
    n("usable","Belegbarer Flächenanteil","80","%","Eigene Annahme für Reihenabstände, Aufbauten und Randzonen."),n("orientation","Lage-/Verlustfaktor","100","%","Eigener Faktor auf den spezifischen Ertrag; Verluste nicht doppelt berücksichtigen."),
    select("direction","Ausrichtung","south",Object.entries(PV_DIRECTIONS).map(([key,value])=>[key,value.label]),"Publizierte Lagefaktoren als Annahmen: Süd 1, Südost/-west 0.95, Ost/West 0.8, Nord-Teil 0.85."),
    select("tilt","Dachneigung","30",Object.keys(PV_TILTS).map(value=>[value,`${value}°`]),"Zusätzliche Neigungsfaktoren des Referenzmodells, keine geometrische Verschattungssimulation."),
    n("yield","Spezifischer Jahresertrag","1050","kWh/kWp","Projekt- oder Standortstudie verwenden; reine Jahresertragsannahme."),
    n("cost","Investition je kWp","1700","CHF/kWp","Angebot inklusive gewünschtem Kostenumfang."),n("historicalCost","Investition Bestandesanlage","22000","CHF","Historischer Gesamtbetrag für die bestehende Anlage."),
    n("commissionedYear","Inbetriebnahmejahr","2020","Jahr","Für die bisherige Ertragsbilanz der Bestandesanlage."),n("valuationYear","Bewertungsjahr","2026","Jahr","Expliziter Zeitbezug der Bestandsbilanz."),
    select("tariffPreset","Bezugstarif · Referenz 2026","CH",[...PV_BUY_TARIFFS.map(item=>[item.id,`${item.label} · ${fmt(item.rp,1)} Rp./kWh`] as [string,string]),["manual","Eigener Bezugstarif"]],"Datiertes veröffentlichtes Tarifbild, kein verbindlicher aktueller Netzbetreibertarif."),
    n("tariff","Vermiedener Bezugspreis","0.29","CHF/kWh","Tatsächlich vermiedener variabler Bezugspreis, ohne pauschale Fixkosten."),
    select("feedPreset","Einspeisetarif · Referenz 2026","CH",[...PV_FEED_TARIFFS.map(item=>[item.id,`${item.label} · ${fmt(item.rp,1)} Rp./kWh`] as [string,string]),["minimum","Minimalvergütung · Referenzstand 01.01.2026"],["manual","Eigener Einspeisetarif"]],"Veröffentlichte Vergütungsannahmen, keine aktuelle Tarifabfrage. Minimalvergütung bildet den datierten EnV-Art.-12-Ansatz ab."),
    n("feed","Einspeisevergütung","0.09","CHF/kWh","Verbindlichen Abnahmetarif manuell eintragen."),
    n("self","Eigenverbrauchsquote","30","%","Anteil des PV-Jahresertrags vor einem optionalen Speicher."),
    select("grantMode","Förderbeitrag","published",[["published","Pronovo-EIV · datierter Referenzansatz"],["manual","Bestätigter Förderbeitrag manuell"]],"Ansätze 01.04.2025 / Boni 01.01.2026. Unverbindlicher Referenzansatz; offizielle Pronovo-Berechnung bleibt massgebend."),
    n("grant","Gesicherter Förderbeitrag","0","CHF","Manuell bestätigter einmaliger Beitrag."),
    select("grantStyle","EIV · Bauart","mounted",[["mounted","Angebaut"],["free","Freistehend"],["integrated","Integriert"]],"Bauart für den datierten Förderansatz."),
    select("grantSelf","EIV / Minimalvergütung · Eigenverbrauch","yes",[["yes","Mit Eigenverbrauch"],["no","Ohne Eigenverbrauch"]],"Programmzuordnung des Referenzansatzes; getrennt von der editierbaren Jahresquote."),
    select("grantSteep","EIV · Neigung mindestens 75°","no",[["no","Nein"],["yes","Ja · Bonusansatz"]],"Bedingungen des datierten Bonusansatzes prüfen."),
    select("grantParking","EIV · Parkfläche","no",[["no","Nein"],["yes","Ja · Bonusansatz ab 100 kWp"]],"Keine automatische baurechtliche oder förderrechtliche Prüfung."),
    select("headlineBasis","Amortisation / Kapitalwert bezogen auf","gross",[["gross","Bruttoinvestition wie Referenz-Hauptwert"],["net","Nettoinvestition nach Förderung"]],"Brutto- und Netto-Amortisation werden getrennt ausgewiesen."),
    select("battery","Batteriespeicher","no",[["no","Ohne Speicher"],["yes","Speicher vergleichen"]],"Vereinfachter zusätzlicher Eigenverbrauch und separate Speicherwirtschaftlichkeit, keine Lastgangsimulation."),
    n("batteryCapacity","Nutzbare Speicherkapazität","10","kWh","Nutzbare, nicht Brutto-Kapazität."),n("batteryCost","Speicher inklusive Installation","10000","CHF","Investition ausschliesslich für den Speicher."),
    n("batteryCycles","Vollzyklen pro Jahr","250","1/a","Projektannahme; für den einfachen Vergleich werden keine stündlichen Lastgänge modelliert."),n("batteryEfficiency","Speicher-Rundlaufwirkungsgrad","90","%","Wird im diskontierten LCOS berücksichtigt."),
    n("batteryDegradation","Speicher-Kapazitätsabnahme","2","%/a","Annahme für die diskontierte Speicherenergie."),n("batteryYears","Speicher-Betrachtungsdauer","15","Jahre","Eigene Lebensdauerannahme des Speichers."),
    n("om","Betriebskosten pro Jahr","1","% Invest.","Konstanter Anteil der Bruttoinvestition."),n("degradation","Ertragsabnahme pro Jahr","0.5","%","Jährliche relative Abnahme des PV-Ertrags."),n("years","Betrachtungsdauer","25","Jahre","Ganzjährige Betrachtung bei konstanten Tarifen."),n("discount","Kalkulationszins","3","%","Für Kapitalwert und diskontierte Kosten."),
    select("emissionMode","CO₂-Vergleich","none",[["none","Ohne Emissionsvergleich"],["project","Mit eigenem Projektfaktor"]],"Optionaler Rechenvergleich aus Jahresertrag und einem selbst bestätigten Faktor, keine Klimabilanz."),
    {...n("emissionFactor","Angenommene vermiedene Emissionen","128","g CO₂e/kWh","128 g/kWh ist nur der datierte Vergleichsansatz. Den zum Projekt passenden Ersatz-/Bilanzfaktor bestätigen; keine pauschale Schweizer Vorgabe."),visibleWhen:[{key:"emissionMode",values:["project"]}]},
  ],
  calculate(input) {
    const sizing=choice(input,"sizing",["modules","power","area","existing"]),roof=choice(input,"roof",["flat","pitched","manual"]);
    const self=number(input,"self","Eigenverbrauch",0,100,true)/100,specific=number(input,"yield","Spezifischer Ertrag",0,3000);
    let usable:number,orientation:number;
    if(roof==="manual") {usable=(sizing==="modules"||sizing==="area")?number(input,"usable","Belegbarer Anteil",0,100)/100:1;orientation=number(input,"orientation","Lagefaktor",0,150)/100;}
    else if(roof==="flat") {usable=.62;orientation=.93;}
    else {usable=.9;const direction=choice(input,"direction",Object.keys(PV_DIRECTIONS)),tilt=choice(input,"tilt",Object.keys(PV_TILTS));orientation=PV_DIRECTIONS[direction].factor*PV_TILTS[tilt];}
    let power:number,moduleCount:number|null=null,moduleArea:number|null=null,efficiency:number|null=null,area:number|null=null;
    if(sizing==="power"||sizing==="existing")power=number(input,"power","Installierte Leistung",0,100000);
    else {
      area=number(input,"area","Dachfläche",0,100000);
      const moduleKey=choice(input,"modulePreset",[...PV_MODULES.map(item=>item.id),"manual"]),preset=PV_MODULES.find(item=>item.id===moduleKey);
      efficiency=preset?preset.efficiency/100:number(input,"efficiency","Modulwirkungsgrad",0,50)/100;
      if(sizing==="modules") {
        moduleArea=preset?preset.area:number(input,"moduleArea","Fläche je Modul",0,20);moduleCount=Math.floor(area*usable/moduleArea+1e-12);
        if(moduleCount<1)throw new Error("Die belegbare Dachfläche reicht nicht für ein vollständiges Modul.");
        power=moduleCount*moduleArea*efficiency;
      } else power=area*usable*efficiency;
    }
    const tariffKey=choice(input,"tariffPreset",[...PV_BUY_TARIFFS.map(item=>item.id),"manual"]),feedKey=choice(input,"feedPreset",[...PV_FEED_TARIFFS.map(item=>item.id),"minimum","manual"]);
    const tariff=tariffKey==="manual"?number(input,"tariff","Bezugspreis",0,5,true):PV_BUY_TARIFFS.find(item=>item.id===tariffKey)!.rp/100;
    const grantSelf=choice(input,"grantSelf",["yes","no"])==="yes";
    const feed=feedKey==="manual"?number(input,"feed","Einspeisetarif",0,5,true):feedKey==="minimum"?publishedMinimumFeedRp(power,grantSelf)/100:PV_FEED_TARIFFS.find(item=>item.id===feedKey)!.rp/100;
    let investment:number,age:number|null=null;
    if(sizing==="existing") {
      investment=number(input,"historicalCost","Historische Investition",0,1e9,true);
      const commissioned=integer(input,"commissionedYear","Inbetriebnahmejahr",1899,2300),valuation=integer(input,"valuationYear","Bewertungsjahr",1899,2300);
      if(valuation<commissioned)throw new Error("Das Bewertungsjahr darf nicht vor der Inbetriebnahme liegen.");age=valuation-commissioned;
    } else investment=power*number(input,"cost","Investition je kWp",0,20000);
    const grantMode=choice(input,"grantMode",["manual","published"]);
    const estimatedGrant=grantMode==="published"?publishedPvGrant(power,choice(input,"grantStyle",["mounted","free","integrated"]) as "mounted"|"free"|"integrated",grantSelf,choice(input,"grantSteep",["yes","no"])==="yes",choice(input,"grantParking",["yes","no"])==="yes"):null;
    const grant=estimatedGrant?estimatedGrant.total:number(input,"grant","Förderbeitrag",0,1e9,true);
    if(grantMode==="manual"&&grant>investment)throw new Error("Förderbeitrag darf die Bruttoinvestition nicht überschreiten.");
    const net=Math.max(0,investment-grant),basis=choice(input,"headlineBasis",["gross","net"]),capital=basis==="gross"?investment:net;
    const om=number(input,"om","Betriebskosten",0,30,true)/100,degradation=number(input,"degradation","Ertragsabnahme",0,20,true)/100,years=integer(input,"years","Betrachtungsdauer",0,50),discount=number(input,"discount","Kalkulationszins",0,30,true)/100;
    const energy=power*specific*orientation,operating=investment*om,rate=self*tariff+(1-self)*feed,firstNet=energy*rate-operating;
    let cumulative=0,discountedEnergy=0,discountedCosts=capital,npv=-capital,totalEnergy=0,payback:number|null=capital===0?0:null,grossPayback:number|null=investment===0?0:null,netPayback:number|null=net===0?0:null;
    const series=[];
    for(let year=1;year<=years;year++) {
      const production=energy*(1-degradation)**(year-1),cash=production*rate-operating,previous=cumulative;cumulative+=cash;
      if(cash>0) {
        if(payback===null&&cumulative>=capital)payback=year-1+(capital-previous)/cash;
        if(grossPayback===null&&cumulative>=investment)grossPayback=year-1+(investment-previous)/cash;
        if(netPayback===null&&cumulative>=net)netPayback=year-1+(net-previous)/cash;
      }
      const denominator=(1+discount)**year;npv+=cash/denominator;discountedCosts+=operating/denominator;discountedEnergy+=production/denominator;totalEnergy+=production;
      series.push({label:`Jahr ${year}`,value:production});
    }
    const pvAnalysis=pvSensitivity({investment,grant,basis:basis as "gross"|"net",annualEnergy:energy,buyPrice:tariff,feedPrice:feed,selfShare:self,operatingShare:om,degradation,years});
    const sensitivityRows=pvAnalysis.scenarios.map(row=>({label:`Sensitivität ±20 % · ${row.label}`,value:`−20 %: ${row.minus===null?`über ${years}`:fmt(row.minus,2)} / +20 %: ${row.plus===null?`über ${years}`:fmt(row.plus,2)} Jahre`}));
    const historyRows=pvAnalysis.history.map(point=>({label:`Tarifhistorie · ${point.year} · Bezug / Einspeisung`,value:`${fmt(point.buyRp,1)} / ${fmt(point.feedRp,1)} Rp./kWh · datierter Vergleich`}));
    const emissionMode=choice({...input,emissionMode:input.emissionMode??"none"},"emissionMode",["none","project"]);
    const emissionFactor=emissionMode==="project"?number(input,"emissionFactor","Vermiedener Emissionsfaktor",0,100000,true):null;
    const emissionRows=emissionFactor===null?[]:[{label:"Vermiedene Emissionen · Projektansatz",value:energy*emissionFactor/1e6,unit:"t CO₂e/a"},{label:"Angenommener vermiedener Emissionsfaktor",value:emissionFactor,unit:"g CO₂e/kWh"}];
    let pastNet:number|null=null;
    if(age!==null)pastNet=Array.from({length:age},(_,index)=>energy*rate*(1-degradation)**index-operating).reduce((sum,value)=>sum+value,0);
    const battery=choice(input,"battery",["no","yes"])==="yes",storageRows:NonNullable<ReturnType<CalculatorDefinition["calculate"]>["rows"]>=[];
    if(battery) {
      const capacity=number(input,"batteryCapacity","Speicherkapazität",0,100000),cost=number(input,"batteryCost","Speicherkosten",0,1e9,true),cycles=number(input,"batteryCycles","Vollzyklen",0,1000),eff=number(input,"batteryEfficiency","Speicherwirkungsgrad",0,100)/100,deg=number(input,"batteryDegradation","Speicherabnahme",0,30,true)/100,lifetime=integer(input,"batteryYears","Speicherjahre",0,50);
      const shifted=Math.min(capacity*cycles,energy*(1-self)),gain=shifted*(tariff-feed);
      const storedDiscounted=Array.from({length:lifetime},(_,index)=>capacity*cycles*eff*(1-deg)**index/(1+discount)**(index+1)).reduce((sum,value)=>sum+value,0);
      storageRows.push({label:"Speicherinvestition · separat",value:cost,unit:"CHF"},{label:"Zusätzlicher Eigenverbrauch · einfacher Ansatz",value:shifted,unit:"kWh/a"},{label:"Eigenverbrauch mit Speicher · einfacher Ansatz",value:(self+shifted/energy)*100,unit:"%"},{label:"Mehrnutzen Speicher pro Jahr",value:gain,unit:"CHF/a"},{label:"Amortisation Speicher · einfacher Ansatz",value:gain>0?cost/gain:"kein positiver Mehrnutzen",unit:gain>0?"Jahre":undefined},{label:"Diskontierter LCOS",value:cost/storedDiscounted*100,unit:"Rp./kWh"});
    }
    return {
      pvAnalysis,
      metrics:[{label:"Anlageleistung · STC",value:power,unit:"kWp",digits:2},{label:"Jahresertrag · Jahr 1",value:energy/1000,unit:"MWh",digits:2},{label:"Nettoinvestition",value:net,unit:"CHF",digits:0},{label:"Amortisation",value:payback===null?`über ${years} Jahre`:payback,unit:payback===null?undefined:"Jahre",digits:1},{label:"Gestehungskosten · nominal",value:(investment+operating*years)/totalEnergy*100,unit:"Rp./kWh",digits:1},{label:"Diskontierte Gestehungskosten",value:discountedCosts/discountedEnergy*100,unit:"Rp./kWh",digits:1},{label:"Kapitalwert",value:npv,unit:"CHF",digits:0,tone:npv>=0?"ok":"warning"}],
      rows:[{label:"Leistungsansatz",value:moduleCount!==null?`${moduleCount} ganze Module · ${fmt(moduleArea!*efficiency!*1000)} Wp je Modul`:sizing==="existing"?"Bestandesanlage mit historischem Gesamtpreis":sizing==="power"?"Direkte kWp-Eingabe":"Kontinuierlicher Flächenansatz"},{label:"Belegungs- / Lagefaktor",value:`${fmt(usable*100)} % / ${fmt(orientation)}`},{label:"Bruttoinvestition",value:investment,unit:"CHF"},{label:"Förderung",value:grant,unit:"CHF"},{label:"Fördergrundlage",value:estimatedGrant?`${estimatedGrant.program} · Ansätze 01.04.2025 / Boni 01.01.2026`:"Manuell bestätigter Beitrag"},{label:"Amortisationsbasis",value:basis==="gross"?"Bruttoinvestition":"Netto nach Förderung"},{label:"Amortisation brutto",value:grossPayback??`über ${years} Jahre`,unit:grossPayback===null?undefined:"Jahre"},{label:"Amortisation netto",value:netPayback??`über ${years} Jahre`,unit:netPayback===null?undefined:"Jahre"},{label:"Bezug / Einspeisung",value:`${fmt(tariff*100)} / ${fmt(feed*100)} Rp./kWh`},{label:"Eigenverbrauch · Jahr 1",value:energy*self,unit:"kWh"},{label:"Einspeisung · Jahr 1",value:energy*(1-self),unit:"kWh"},{label:"Nettoertrag · Jahr 1",value:firstNet,unit:"CHF"},...(age===null?[]:[{label:"Alter im Bewertungsjahr",value:age,unit:"Jahre"},{label:"Bisheriger kumulierter Nettoertrag",value:pastNet!,unit:"CHF"}]),...storageRows,...emissionRows,...sensitivityRows,...historyRows],
      status:{tone:firstNet<=0||grant>investment?"warning":npv>=0?"ok":"neutral",text:firstNet<=0?"Mit diesen Annahmen ist der jährliche Nettoertrag nicht positiv.":grant>investment?"Der unverbindliche Förderansatz übersteigt die Investition; Förderfähigkeit und Kostengrundlage prüfen.":"Ertrag und Wirtschaftlichkeit aus den ausgewählten Referenz-/Projektannahmen berechnet."},
      formula:`${moduleCount!==null?`n_Module = floor(${fmt(area!)} × ${fmt(usable)} / ${fmt(moduleArea!)}) = ${moduleCount}; P_STC = ${moduleCount} × ${fmt(moduleArea!)} × ${fmt(efficiency!)} = ${fmt(power)} kWp`:sizing==="area"?`P_STC = ${fmt(area!)} × ${fmt(usable)} × ${fmt(efficiency!)} = ${fmt(power)} kWp`:`P_STC = ${fmt(power)} kWp (direkte Eingabe)`}; E₁ = P_STC × Ertrag × Lagefaktor = ${fmt(power)} × ${fmt(specific)} × ${fmt(orientation)} = ${fmt(energy)} kWh; CF₁ = ${fmt(energy)} × (${fmt(self)} × ${fmt(tariff)} + ${fmt(1-self)} × ${fmt(feed)}) − ${fmt(operating)} = ${fmt(firstNet)} CHF; Kapitalwert = −${fmt(capital)} + Σ CF_y/(1+${fmt(discount)})^y = ${fmt(npv)} CHF`,
      series,seriesLabel:"Jahresertrag über die Betrachtungsdauer",seriesUnit:"kWh/Jahr",
      limitations:["Dachbelegung, Lage, Modulparameter und Speicherzyklen sind vereinfachte Referenz-/Projektannahmen. Es ist kein aktueller PVGIS-, Netzbetreiber- oder Pronovo-Dienst angebunden. Tarifsnapshot 2026, Minimalvergütung EnV Art. 12 Referenzstand 01.01.2026; EIV-Ansätze 01.04.2025 / Boni 01.01.2026 unverbindlich bestätigen.","Sensitivität variiert jeweils einen Parameter um ±20 % bei den aktuellen Projektannahmen. Unveränderte Förderung bleibt im Nettofall separat; Eigenverbrauch höchstens 100 %. Fehlende Amortisation wird nicht als null Jahre dargestellt. Tarifhistorie 2020–2026 aus datierten Vergleichsdaten, keine aktuelle Tarifauskunft oder Prognose. Ein optionaler CO₂-Vergleich multipliziert den Jahresertrag mit dem ausdrücklich eingegebenen Projektfaktor; ohne Lebenszyklus-, Zusätzlichkeits- oder Herkunftsnachweis.","PV-Hauptwerte enthalten den optionalen Speicher nicht. Der einfache Speicher-Zusatznutzen setzt idealisierte Energieverschiebung ohne Rundlaufverluste an; LCOS berücksichtigt dagegen den eingegebenen Wirkungsgrad und die Alterung. Keine Lastgang-, Verschattungs-, Einspeisespitzen-, Wechselrichter-, Steuer- oder Finanzierungsplanung."],
    };
  },
};
for(const inputField of pv.fields) {
  const key=inputField.key;
  if(["sizing","roof","modulePreset","moduleArea","efficiency","power","area","usable","orientation","direction","tilt","commissionedYear","valuationYear"].includes(key))inputField.group="Dach & Anlage";
  else if(["yield","tariffPreset","tariff","feedPreset","feed","self"].includes(key))inputField.group="Ertrag & Tarife";
  else if(key.startsWith("grant"))inputField.group="Förderung";
  else if(key.startsWith("battery"))inputField.group="Speicher";
  else if(key.startsWith("emission"))inputField.group="CO₂-Projektvergleich";
  else inputField.group="Wirtschaftlichkeit";
  if(["modulePreset","area"].includes(key))inputField.visibleWhen=[{key:"sizing",values:["modules","area"]}];
  if(key==="moduleArea")inputField.visibleWhen=[{key:"sizing",values:["modules"]},{key:"modulePreset",values:["manual"]}];
  if(key==="efficiency")inputField.visibleWhen=[{key:"sizing",values:["modules","area"]},{key:"modulePreset",values:["manual"]}];
  if(key==="power")inputField.visibleWhen=[{key:"sizing",values:["power","existing"]}];
  if(key==="usable")inputField.visibleWhen=[{key:"sizing",values:["modules","area"]},{key:"roof",values:["manual"]}];
  if(key==="orientation")inputField.visibleWhen=[{key:"roof",values:["manual"]}];
  if(["direction","tilt"].includes(key))inputField.visibleWhen=[{key:"roof",values:["pitched"]}];
  if(key==="cost")inputField.visibleWhen=[{key:"sizing",values:["modules","area","power"]}];
  if(["historicalCost","commissionedYear","valuationYear"].includes(key))inputField.visibleWhen=[{key:"sizing",values:["existing"]}];
  if(key==="tariff")inputField.visibleWhen=[{key:"tariffPreset",values:["manual"]}];
  if(key==="feed")inputField.visibleWhen=[{key:"feedPreset",values:["manual"]}];
  if(key==="grant")inputField.visibleWhen=[{key:"grantMode",values:["manual"]}];
  if(["grantStyle","grantSteep","grantParking"].includes(key))inputField.visibleWhen=[{key:"grantMode",values:["published"]}];
  if(key.startsWith("battery")&&key!=="battery")inputField.visibleWhen=[{key:"battery",values:["yes"]}];
  inputField.group=["sizing","roof","modulePreset","area","moduleArea","efficiency","power","usable","orientation","direction","tilt","yield","cost","historicalCost","commissionedYear","valuationYear"].includes(key)?"Anlage":key.startsWith("battery")?"Speicher":["om","degradation","years","discount","headlineBasis"].includes(key)?"Wirtschaftlichkeit":"Tarife & Förderung";
}

const fireFields: Field[] = [select("route","Fluchtweg","horizontal",[["horizontal","Horizontal"],["vertical","Vertikal"]],"Die numerische Grenze der öffentlichen Referenz bezieht sich auf horizontale Fluchtwege. Vertikale Fluchtwege erhalten hier keine Freigabebewertung."),n("length","Fluchtweglänge","10","m","Bezugsstrecke als Divisor der gesamten Brandlast."),n("limit","Projektgrenze horizontal","200","MJ/m","Öffentliche Referenz zu VKF BSR 14-15: 200 MJ/m. Die Anwendbarkeit muss der Brandschutzplaner bestätigen; keine pauschale Zulassung einzelner Kabel."),select("proof","Brandverhalten der eingetragenen Kabel","open",[["open","CPR-/Ausführungsnachweise offen"],["documented","Nachweise projektbezogen dokumentiert"],["critical","Kritisches Verhalten vorhanden"]],"Die Einstufung ist eine ausdrückliche Projekteingabe, keine automatische CPR- oder Herstellerprüfung.")];
for(let line=1;line<=3;line++)fireFields.push(n(`q${line}`,`Brandlast je Meter · Position ${line}`,line===1?"3":line===2?"0.5":"0","MJ/m","Herstellerwert pro Kabelmeter. Halogenfreiheit allein ist kein Brandlastwert.",`Kabelposition ${line}`),n(`n${line}`,`Anzahl · Position ${line}`,line===1?"10":line===2?"5":"0","Stk.","Anzahl gleicher Kabel dieser Position; 0 lässt die Position unberücksichtigt.",`Kabelposition ${line}`),n(`l${line}`,`Kabellänge im Fluchtweg · Position ${line}`,line===1?"10":line===2?"6":"0","m","Tatsächlich im Fluchtweg verlaufende Länge je Kabel dieser Position.",`Kabelposition ${line}`));
export interface FireLoadPosition { name:string; mjPerMeter:number; quantity:number; length:number; evidence:"open"|"documented"|"critical" }
export function calculateFireLoadPositions(positions: readonly FireLoadPosition[], length: number, route:"horizontal"|"vertical", limit=200): ReturnType<CalculatorDefinition["calculate"]> {
  if(!Number.isFinite(length)||length<=0||length>100000||!Number.isFinite(limit)||limit<=0||!["horizontal","vertical"].includes(route))throw new Error("Fluchtweg, positive Bezugsstrecke und Grenze prüfen.");
  if(!Array.isArray(positions)||positions.length>1000)throw new Error("Höchstens 1000 Kabelpositionen eingeben.");
  const rows:NonNullable<ReturnType<CalculatorDefinition["calculate"]>["rows"]>=[];
  let total=0,cables=0,critical=false,open=false;
  for(const [index,position] of positions.entries()) {
    if(!position||typeof position.name!=="string"||position.name.length>180||!["open","documented","critical"].includes(position.evidence))throw new Error(`Position ${index+1}: Bezeichnung und Nachweisstatus prüfen.`);
    const {mjPerMeter:q,quantity:n,length:l}=position;
    if(!Number.isFinite(q)||q<0||q>100000||!Number.isInteger(n)||n<0||n>100000||!Number.isFinite(l)||l<0||l>100000)throw new Error(`Position ${index+1}: gültige Zahlen und ganze Anzahl eingeben.`);
    if(n>0&&(q===0||l===0))throw new Error(`Position ${index+1}: Vorhandene Kabel benötigen positive Brandlast und Länge.`);
    const energy=q*n*l;total+=energy;cables+=n;
    if(n>0) {
      critical ||= position.evidence==="critical";open ||= position.evidence==="open";
      rows.push({label:`${position.name.trim()||`Position ${index+1}`} · ${n} × ${fmt(l)} m × ${fmt(q)} MJ/m`,value:energy,unit:"MJ"});
    }
  }
  const density=total/length,exceeds=!lte(density,limit),tone=cables===0?"neutral":critical||route==="horizontal"&&exceeds?"error":route==="vertical"||open?"warning":"ok";
  const text=cables===0?"Keine Kabel erfasst; die leere Mengenbilanz ist kein Ausführungsnachweis.":critical?"Kritisches Brandverhalten eingetragen: die Zahlenbilanz allein reicht nicht aus.":route==="vertical"?"Vertikaler Fluchtweg: Mengenbilanz ohne pauschale 200-MJ/m-Freigabe.":exceeds?"Die horizontale Vergleichsgrenze ist überschritten.":open?"Brandlast unter der Vergleichsgrenze; Nachweise zu Kabeln und Ausführung sind offen.":"Die Zahlenbilanz liegt unter der horizontalen Vergleichsgrenze; Anwendbarkeit und Ausführung separat bestätigen.";
  return {
    metrics:[{label:"Brandlast bezogen auf Fluchtweg",value:density,unit:"MJ/m",digits:1,tone},{label:"Brandlast total",value:total,unit:"MJ",digits:1},{label:"Kabel total",value:cables,unit:"Stk."}],rows,status:{tone,text},
    formula:`Q_total = Σ(q_i × Anzahl_i × Kabellänge_i) = ${rows.length?rows.map(row=>`${fmt(Number(row.value))} MJ`).join(" + "):"0 MJ"} = ${fmt(total)} MJ; q_Fluchtweg = ${fmt(total)} / ${fmt(length)} = ${fmt(density)} MJ/m${route==="vertical"?"; vertikal ohne pauschalen 200-MJ/m-Vergleich":`; Vergleich ${fmt(limit)} MJ/m`}`,
    series:route==="horizontal"?[{label:"Berechnete Brandlast",value:density},{label:"Vergleichsgrenze",value:limit}]:[{label:"Berechnete Brandlast",value:density}],seriesLabel:route==="horizontal"?"Horizontaler Vergleich":"Vertikale Mengenbilanz",seriesUnit:"MJ/m",
      limitations:["Kabelwerte stammen aus manuellen Projektangaben oder dem datierten Referenzkatalog. Die dort publizierten Lieferanten-/CPR-Daten und ca.-Richtwerte sind keine unabhängig bestätigten Herstellerbelege; passende Leistungserklärung und Projektzuordnung prüfen. VKF BSR 14-15 Ziffer 5.2.1 / NIN 4.2.2.2.7 am Projekt prüfen. 200 MJ/m ist der horizontale Referenzvergleich, keine pauschale vertikale Freigabe.","Ein Mittelwert über die Bezugsstrecke bewertet keine lokalen Kabelhäufungen. CPR, kritisches Brandverhalten, Funktionserhalt und Ausführung sind getrennte Nachweise."],
  };
}
export interface FireLoadRow { id:string; name:string; mjPerMeter:string; quantity:string; length:string; evidence:"open"|"documented"|"critical"; catalogId?:string; supplier?:string; cpr?:string }
export const FIRE_LOAD_DEFAULT_ROWS: readonly FireLoadRow[] = [
  {id:"fire-example-1",name:"Beispiel Kabelposition 1",mjPerMeter:"3",quantity:"10",length:"10",evidence:"open"},
  {id:"fire-example-2",name:"Beispiel Kabelposition 2",mjPerMeter:"0.5",quantity:"5",length:"6",evidence:"open"},
];
export function createFireLoadRow(id:string,name="Neue Kabelposition"):FireLoadRow {
  if(!id.trim()||id.length>120)throw new Error("Eine eindeutige Zeilenkennung ist erforderlich.");
  return {id,name,mjPerMeter:"",quantity:"1",length:"",evidence:"open"};
}
export function parseFireLoadRows(raw:string,editing=false,diagnosticField="fireloadRows"):FireLoadRow[] {
  if(typeof raw!=="string"||raw.length>500000)throw new Error("Kabelpositionsliste ist ungültig oder zu gross.");
  let parsed:unknown;
  try {parsed=JSON.parse(raw);} catch {throw new Error("Kabelpositionsliste konnte nicht gelesen werden.");}
  if(!Array.isArray(parsed)||parsed.length>1000)throw new Error("Höchstens 1000 Kabelpositionen eingeben.");
  const ids=new Set<string>(),keys=["id","name","mjPerMeter","quantity","length","evidence"],optionalKeys=["catalogId","supplier","cpr"];
  return parsed.map((value:unknown,index)=>{
    if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)&&!optionalKeys.includes(key)))throw new Error(`Position ${index+1}: ungültige Zeilenstruktur.`);
    const row=value as Record<string,unknown>;
    if(keys.some(key=>typeof row[key]!=="string"))throw new Error(`Position ${index+1}: alle Werte als Textfelder eingeben.`);
    if(optionalKeys.some(key=>row[key]!==undefined&&(typeof row[key]!=="string"||(row[key] as string).length>180)))throw new Error(`Position ${index+1}: Katalog-/CPR-Daten prüfen.`);
    const id=row.id as string,name=row.name as string,mjPerMeter=row.mjPerMeter as string,quantity=row.quantity as string,length=row.length as string,evidence=row.evidence as FireLoadRow["evidence"];
    if(!id.trim()||id.length>120||ids.has(id))throw new Error(`Position ${index+1}: fehlende oder doppelte Zeilenkennung.`);
    if(name.length>180||[mjPerMeter,quantity,length].some(field=>field.length>24)||!["open","documented","critical"].includes(evidence))throw new Error(`Position ${index+1}: Bezeichnung, Zahlenfeldlänge oder Nachweisstatus prüfen.`);
    ids.add(id);
    const catalogId=row.catalogId as string|undefined,supplier=row.supplier as string|undefined,cpr=row.cpr as string|undefined;
    if(catalogId) {
      const fact=fireCableFact(catalogId);
      if(supplier&&!fact.suppliers.some(item=>item.supplier===supplier))throw new Error(`Position ${index+1}: Lieferant hat keinen plausiblen Katalogwert.`);
    }
    if(!editing) {
      withInputRow(diagnosticField,{id},index,()=>{
        const values={mjPerMeter,quantity,length};
        const q=number(values,"mjPerMeter",`Brandlast Position ${index+1}`,0,100000,true),n=integer(values,"quantity",`Anzahl Position ${index+1}`,0,100000,true),l=number(values,"length",`Länge Position ${index+1}`,0,100000,true);
        if(n>0&&(q===0||l===0))throw new InputError(q===0?"mjPerMeter":"length",`Position ${index+1}: vorhandene Kabel benötigen positive Brandlast und Länge.`,"Bei vorhandenen Kabeln müssen Brandlast je Meter und betrachtete Kabellänge grösser als null sein.",q===0?mjPerMeter:length);
      });
    }
    return {id,name,mjPerMeter,quantity,length,evidence,...(catalogId!==undefined?{catalogId}:{}),...(supplier!==undefined?{supplier}:{}),...(cpr!==undefined?{cpr}:{})};
  });
}
export function fireLoadRowsToPositions(rows: readonly FireLoadRow[]):FireLoadPosition[] {
  const validated=parseFireLoadRows(JSON.stringify(rows));
  return validated.map(row=>{
    const catalogCpr=row.catalogId?fireCableFact(row.catalogId).cpr:undefined,cpr=fireCprState(row.cpr??catalogCpr??"");
    // Explicit critical CPR cannot be cleared by a generic confirmation checkbox.
    // Existing manual records without a CPR field retain their evidence status.
    const evidence=row.evidence==="critical"||cpr==="critical"||fireCprState(catalogCpr??"")==="critical"?"critical":(row.cpr||catalogCpr)&&cpr==="open"?"open":row.evidence;
    return {name:row.name,mjPerMeter:Number(row.mjPerMeter.replace(",",".")),quantity:Number(row.quantity.replace(",",".")),length:Number(row.length.replace(",",".")),evidence};
  });
}
for(const field of fireFields) {
  if(field.key==="proof"||/^[qnl][123]$/.test(field.key))field.visibleWhen=[{key:"fireloadMode",values:["legacy"]}];
}
const fire: CalculatorDefinition={
  id:"brandlast",title:"Brandlast · Grundrechnung",description:"Eigene Kabelpositionen mit belegten Brandlastwerten auf die Fluchtweglänge beziehen.",source:source("brandlast-fluchtweg.html"),scope:"VKF BSR 14-15 Ziffer 5.2.1 · NIN 4.2.2.2.7 · Kabelwerte und Nachweise als Projekteingaben",
  fields:[select("fireloadMode","Kabelerfassung","dynamic",[["dynamic","Kabelpositionsliste"],["legacy","Gespeicherte drei Positionen"]],"Beispielpositionen sind manuelle Rechenbeispiele und keine Herstellerdaten."),...fireFields,{key:"fireloadRows",label:"Kabelpositionen",kind:"text",default:JSON.stringify(FIRE_LOAD_DEFAULT_ROWS),help:"Eigene Brandlast je Meter, Anzahl, tatsächliche Länge im Fluchtweg und Nachweisstatus je Position.",visibleWhen:[{key:"fireloadMode",values:["dynamic"]}]}],
  calculate(input) {
    const length=number(input,"length","Fluchtweglänge",0,100000),limit=number(input,"limit","Projektgrenze",0,100000),route=choice(input,"route",["horizontal","vertical"]) as "horizontal"|"vertical",mode=choice(input,"fireloadMode",["dynamic","legacy"]);
    if(mode==="dynamic")return calculateFireLoadPositions(fireLoadRowsToPositions(parseFireLoadRows(input.fireloadRows)),length,route,limit);
    const proof=choice(input,"proof",["open","documented","critical"]) as FireLoadPosition["evidence"];
    const positions=[1,2,3].map(line=>({name:`Position ${line}`,mjPerMeter:number(input,`q${line}`,`Brandlast Position ${line}`,0,100000,true),quantity:integer(input,`n${line}`,`Anzahl Position ${line}`,0,100000,true),length:number(input,`l${line}`,`Länge Position ${line}`,0,100000,true),evidence:proof}));
    return calculateFireLoadPositions(positions,length,route,limit);
  },
};

export const POE_PROFILES: Readonly<Record<string, { groups: number; current: number; budget: number; minimumPD: number }>> = {
  "1": { groups: 1, current: .35, budget: 13, minimumPD: 37 },
  "2": { groups: 1, current: .6, budget: 25, minimumPD: 42.5 },
  "3": { groups: 2, current: .65, budget: 55, minimumPD: 42.5 },
  "4": { groups: 2, current: 1, budget: 90, minimumPD: 41.1 },
};

const poe: CalculatorDefinition = {
  id: "poe", title: "PoE · DC-Leistungsbudget",
  description: "PoE-Typ, Speisung und Spannungsreserve am Endgerät vergleichen.",
  source: source("poe-rechner.html"),
  scope: "IEEE 802.3 · typabhängige PD-Mindestspannung; manuelle Kabeldaten und Referenz-Leistungsannahmen",
  fields: [
    select("type", "PoE-Typ · IEEE 802.3", "4", [["1","Typ 1 · 802.3af"],["2","Typ 2 · 802.3at"],["3","Typ 3 · 802.3bt"],["4","Typ 4 · 802.3bt"],["manual","Manuelles DC-Modell · kein PoE-Typnachweis"]], "PD-Mindestspannung: Typ 1 37 V, Typ 2/3 42.5 V, Typ 4 41.1 V. Die Referenz-Leistungsbudgets 13/25/55/90 W und Stromansätze sind keine vollständige Klassen-/Geräteprüfung."),
    select("cable", "Kabelansatz", "cat6a-s-awg23", [...POE_CABLE_REFERENCES.map(cable=>[cable.id,`${cable.label} · ${fmt(cable.resistance20)} Ω/100 m`] as [string,string]),["manual","Eigener Einzeladerwiderstand"]], "Generische veröffentlichte Referenzansätze, keine Hersteller- oder Normgarantie. Eigenen Datenblattwert über die manuelle Auswahl eingeben."),
    n("voltage", "PSE-Spannung", "53", "V", "Gleichspannung des konkreten Speisegeräts aus dessen Datenblatt."),
    n("power", "Leistungsbudget am PSE", "90", "W", "Zusätzlich zum Gerätebudget begrenzt der gewählte Referenz-Typansatz die Leistung auf 13/25/55/90 W. Im manuellen DC-Modell gilt allein diese Eingabe."),
    select("circuits", "Speisende Paargruppen", "2", [["1","1 Paargruppe · 2 Aderpaare"],["2","2 Paargruppen · 4 Aderpaare"]], "Typ 1/2 verwendet eine, Typ 3/4 zwei gleichartig belastete Paargruppen. Pro Gruppe führen zwei parallele Adern hin und zwei zurück."),
    n("maxCurrent", "Geräte-Stromgrenze je Paargruppe", "1", "A", "Zusätzlicher Gerätewert. Der Typansatz begrenzt je Gruppe auf 0.35 / 0.6 / 0.65 / 1 A; diese publizierten Referenzannahmen am Gerät bestätigen."),
    n("length", "Kanallänge inklusive Patchleitungen", "90", "m", "Einfache Länge des betrachteten 100-m-Ethernet-Kanals. Zusatzwiderstände der Steckverbinder getrennt erfassen."),
    n("resistance", "Widerstand einer Ader bei 20 °C", "9.38", "Ω/100 m", "Einzeladerwert aus dem Kabeldatenblatt, kein Paar- oder Schleifenwiderstand. Zwei parallele Adern je Richtung ergeben pro Paargruppe R_Schleife = R_Ader."),
    n("temperature", "Angenommene Leitertemperatur", "20", "°C", "Eingegebene Kupfertemperatur mit α = 0.00393/K, keine thermische Bündelberechnung."),
    n("connector", "Zusätzlicher Schleifenwiderstand je Gruppe", "0", "Ω", "Summe der zusätzlichen Kontakt- und Steckverbinderwiderstände je Paargruppe."),
  ],
  calculate(input) {
    const type = choice(input, "type", ["1", "2", "3", "4", "manual"]), profile=type==="manual"?null:POE_PROFILES[type];
    const cable=choice(input,"cable",[...POE_CABLE_REFERENCES.map(item=>item.id),"manual"]),preset=POE_CABLE_REFERENCES.find(item=>item.id===cable);
    const voltage = number(input, "voltage", "PSE-Spannung", 0, 100), requestedPower = profile?profile.budget:number(input, "power", "PSE-Leistungsbudget", 0, 1000);
    const circuits = profile?profile.groups:integer(input, "circuits", "Paargruppen", 0, 2), deviceCurrent = profile?profile.current:number(input, "maxCurrent", "Geräte-Stromgrenze", 0, 5);
    const length = number(input, "length", "Kanallänge", 0, 10000), r20 = preset?preset.resistance20:number(input, "resistance", "Aderwiderstand", 0, 100);
    const temperature = number(input, "temperature", "Leitertemperatur", 0, 100, true), connector = number(input, "connector", "Kontaktwiderstand", 0, 100, true);
    const allowedPower=requestedPower,allowedCurrent=deviceCurrent;
    const wire = r20 * length / 100 * (1 + .00393 * (temperature - 20));
    const loopPerGroup = wire + connector, equivalent = loopPerGroup / circuits;
    const current = Math.min(allowedPower / voltage, allowedCurrent * circuits);
    const drop = current * equivalent, outputVoltage = voltage - drop;
    if (outputVoltage <= 0) throw new Error("DC-Modellgrenze: Spannungsfall erreicht die Speisespannung. Leitung oder Leistungsbudget prüfen.");
    const actualPSE = voltage * current, loss = current * drop, pd = outputVoltage * current;
    const capped = actualPSE < requestedPower - 1e-9, underVoltage = profile !== null && outputVoltage < profile.minimumPD - 1e-9, overLength = length > 100;
    const designAderCurrent=profile?profile.current/2:null, bundleRms=profile?designAderCurrent!*Math.sqrt(profile.groups*4/8):null;
    const rp=bundleRms===null?null:bundleRms<.212?"RP1":bundleRms<=.499?"RP2":"RP3";
    const label = profile ? `PoE Typ ${type}` : "Manuelles DC-Modell";
    const tone = underVoltage || overLength ? "error" : capped ? "warning" : "neutral";
    const text = overLength ? "100-m-Kanallänge überschritten: kein gültiger Kanal im betrachteten Ethernet-Modell." : underVoltage ? `${label}: PD-Spannung unter ${fmt(profile!.minimumPD)} V Mindestspannung.` : capped ? `${label}: Leistung wird durch Geräte- oder Referenz-Typansatz begrenzt.` : profile ? `${label}: PD-Mindestspannung eingehalten; Klassen-, Geräte- und Datennachweise bleiben offen.` : "Manuelles DC-Modell; keine typabhängige PoE-Prüfung durchgeführt.";
    return {
      metrics: [{ label: "Leistung am Endgerät", value: pd, unit: "W", digits: 1 }, { label: "Spannung am Endgerät", value: outputVoltage, unit: "V", digits: 2, tone: underVoltage ? "error" : "neutral" }, { label: "Kabel-/Kontaktverlust", value: loss, unit: "W", digits: 2 }, { label: "DC-Spannungsfall", value: drop / voltage * 100, unit: "%", digits: 1 }],
      rows: [{ label: "Ausgewählter Typ", value: label }, {label:"Kabelansatz",value:preset?preset.label:"Eigener Datenblattwert"}, {label:"RP-Kategorie · Referenzansatz",value:rp??"Nicht klassifiziert"}, {label:"Bündel-Effektivstrom je Ader · Typ-Maximum",value:bundleRms===null?"nicht bestimmt":bundleRms*1000,unit:bundleRms===null?undefined:"mA"}, { label: "PD-Mindestspannung", value: profile ? profile.minimumPD : "kein Typ gewählt", unit: profile ? "V" : undefined }, { label: "Speisende Paargruppen", value: circuits }, { label: "Strom aus dem PSE", value: current, unit: "A" }, { label: "Strom je Ader · gleichmässig", value: current / (2 * circuits) * 1000, unit: "mA" }, { label: "Äquivalenter Schleifenwiderstand", value: equivalent, unit: "Ω" }, { label: "Tatsächliche PSE-Leistung im Modell", value: actualPSE, unit: "W" }, { label: "100-m-Kanal", value: overLength ? "überschritten" : "innerhalb" }],
      status: { tone, text },
      formula: `R_Ader,T = R′₂₀ × L/100 × [1 + α(T−20)] = ${fmt(r20)} × ${fmt(length)}/100 × [1 + 0.00393 × (${fmt(temperature)}−20)] = ${fmt(wire)} Ω; R_Schleife,Gruppe = R_Ader,T + R_Kontakte; R_eq = (${fmt(wire)} + ${fmt(connector)}) / ${circuits} = ${fmt(equivalent)} Ω; I = min(${fmt(allowedPower)} / ${fmt(voltage)}, ${circuits} × ${fmt(allowedCurrent)}) = ${fmt(current)} A; ΔU = ${fmt(current)} × ${fmt(equivalent)} = ${fmt(drop)} V; U_PD = ${fmt(voltage)} − ${fmt(drop)} = ${fmt(outputVoltage)} V; P_V = I × ΔU = ${fmt(loss)} W; P_PD = U_PD × I = ${fmt(pd)} W${rp?`; I_c,Referenz = ${fmt(designAderCurrent!)} × √(${profile!.groups*4}/8) = ${fmt(bundleRms!)} A (${rp}, reines Typ-Bündel)` : ""}`,
      diagram: { kind: "chain", nodes: [{ label: `PSE · ${label}`, value: `${fmt(actualPSE, 1)} W`, detail: `${fmt(voltage)} V` }, { label: "Leitung & Kontakte", value: `−${fmt(loss, 1)} W`, detail: `${fmt(length)} m · ${fmt(temperature)} °C` }, { label: "Endgerät · PD", value: `${fmt(pd, 1)} W`, detail: `${fmt(outputVoltage, 1)} V${profile ? ` · min. ${fmt(profile.minimumPD)} V` : ""}`, tone: underVoltage ? "error" : "neutral" }] },
      series: [{ label: "PSE-Spannung", value: voltage }, { label: "PD-Spannung", value: outputVoltage }, ...(profile ? [{ label: `Minimum Typ ${type}`, value: profile.minimumPD }] : [])], seriesLabel: "Spannungsreserve am Endgerät", seriesUnit: "V",
      limitations: ["Die Typ-Leistungsbudgets und Stromansätze reproduzieren publizierte Referenzannahmen, keine vollständige IEEE-Klassentabelle. PSE-Spannungsbereich, Aushandlung, Anschlussart und Geräteklasse separat aus Datenblättern prüfen.", "Die 100-m-Grenze bezieht sich auf den betrachteten normierten Ethernet-Kanal inklusive Patchleitungen. RP wird ausschliesslich als publizierter Worst-Case-Ansatz für ein homogenes Bündel des gewählten Typs ausgewiesen. Keine gemischte Bündel-, Datendämpfungs- oder thermische Zertifizierung; Temperatur und eigene Widerstände sind Eingaben."],
    };
  },
};

for(const inputField of poe.fields) {
  if(["power","circuits","maxCurrent"].includes(inputField.key)) inputField.visibleWhen=[{key:"type",values:["manual"]}];
  if(inputField.key==="resistance") inputField.visibleWhen=[{key:"cable",values:["manual"]}];
}

export const INSTALLATION: CalculatorDefinition[] = [nin,ampacity,breaker,bonding,pv,fire,poe];
