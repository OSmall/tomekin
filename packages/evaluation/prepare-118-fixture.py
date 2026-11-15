import sys,gzip,json,csv
from pathlib import Path
src,tags,out=map(Path,sys.argv[1:])
out.mkdir(parents=True,exist_ok=False)
with gzip.open(src,'rt') as f: cards=[json.loads(x) for x in f]
with gzip.open(tags,'rt') as f: tagdata=[json.loads(x) for x in f]
def allowed(c): return 'paper' in c.get('games',[]) and c.get('legalities',{}).get('commander')=='legal' and not c.get('digital')
base=[c for c in cards if allowed(c) and isinstance(c.get('edhrec_rank'),int) and c['edhrec_rank']<=1500]
more=sorted((c for c in cards if allowed(c) and 'Creature' in c.get('type_line','') and c.get('power') in ['0','1','2'] and set(c.get('color_identity',[]))<=set('WBR') and isinstance(c.get('edhrec_rank'),int)),key=lambda c:c['edhrec_rank'])[:300]
required=['Alesha, Who Smiles at Death','Tatyova, Benthic Druid','Cultivate','Blighted Woodland','War Room','Island','Forest','Mountain','Plains','Swamp']
byname={c['name']:c for c in cards}
selected={c['oracle_id']:c for c in base+more+[byname[n] for n in required]}
subset=sorted(selected.values(),key=lambda c:c['name'])
for filename,data in [('oracle.json',cards),('selected-printings.json',subset),('tags.json',tagdata)]:
 with open(out/filename,'w') as f:json.dump(data,f,separators=(',',':'))
columns=['Binder Name','Binder Type','Name','Set code','Set name','Collector number','Foil','Rarity','Quantity','ManaBox ID','Scryfall ID','Purchase price','Misprint','Altered','Condition','Language','Purchase price currency','Added']
with open(out/'synthetic-collection.csv','w',newline='') as f:
 w=csv.writer(f);w.writerow(columns)
 for c in subset:
  basic=c['name'] in ['Island','Forest','Mountain','Plains','Swamp']
  w.writerow(['Acceptance Binder','binder',c['name'],c['set'],c['set_name'],c['collector_number'],'normal' if 'nonfoil' in c['finishes'] else 'foil',c['rarity'],50 if basic else 4,'',c['id'],'','false','false','near_mint',c['lang'],'AUD',''])
 c=byname['War Room'];w.writerow(['Protected Deck','deck',c['name'],c['set'],c['set_name'],c['collector_number'],'normal' if 'nonfoil' in c['finishes'] else 'foil',c['rarity'],1,'',c['id'],'','false','false','near_mint',c['lang'],'AUD',''])
