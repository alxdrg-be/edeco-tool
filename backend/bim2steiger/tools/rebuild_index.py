"""Rebuild the local index from the portable JSON package, without a login."""
import json,sqlite3,sys
from pathlib import Path
def rebuild(data_dir):
    data_dir=Path(data_dir);catalog=json.loads((data_dir/'catalogue.json').read_text(encoding='utf-8'));package=json.loads((data_dir/'assemblies.json').read_text(encoding='utf-8'))
    path=data_dir/'catalogue.rebuild.sqlite';db=sqlite3.connect(path)
    db.executescript('''DROP TABLE IF EXISTS articles;DROP TABLE IF EXISTS variants;DROP TABLE IF EXISTS roots;DROP TABLE IF EXISTS recipes;DROP TABLE IF EXISTS metadata;DROP TABLE IF EXISTS articles_fts;
    CREATE TABLE articles(number TEXT PRIMARY KEY,name TEXT NOT NULL,search_text TEXT NOT NULL,complete_position INTEGER NOT NULL,data TEXT NOT NULL);
    CREATE TABLE variants(id TEXT PRIMARY KEY,number TEXT NOT NULL,va TEXT NOT NULL,status TEXT NOT NULL,data TEXT NOT NULL);
    CREATE INDEX variants_number ON variants(number);
    CREATE TABLE roots(id TEXT PRIMARY KEY,data TEXT NOT NULL);
    CREATE TABLE recipes(id TEXT PRIMARY KEY,variant TEXT NOT NULL,data TEXT NOT NULL);
    CREATE INDEX recipes_variant ON recipes(variant);
    CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE VIRTUAL TABLE articles_fts USING fts5(number UNINDEXED,search_text,tokenize='unicode61 remove_diacritics 2');''')
    js=lambda x:json.dumps(x,ensure_ascii=False,separators=(',',':'))
    db.executemany('INSERT INTO articles VALUES(?,?,?,?,?)',[(a['number'],a['name'],a['search_text'],int(a['complete_position']),js(a)) for a in catalog['articles']])
    db.executemany('INSERT INTO articles_fts VALUES(?,?)',[(a['number'],a['search_text']) for a in catalog['articles']])
    db.executemany('INSERT INTO variants VALUES(?,?,?,?,?)',[(k,v['number'],v['va'],v['status'],js(v)) for k,v in package['variants'].items()])
    db.executemany('INSERT INTO roots VALUES(?,?)',[(k,js(v)) for k,v in package['roots'].items()])
    db.executemany('INSERT INTO recipes VALUES(?,?,?)',[(k,v['variant'],js(v)) for k,v in package['recipes'].items()])
    db.executemany('INSERT INTO metadata VALUES(?,?)',[(k,js(v)) for k,v in package['metadata'].items()])
    db.commit();assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok';db.close();path.replace(data_dir/'catalogue.sqlite')
    return {'articles':len(catalog['articles']),'roots':len(package['roots']),'recipes':len(package['recipes'])}
if __name__=='__main__':print(json.dumps(rebuild(Path(__file__).resolve().parents[1]/'data')))
