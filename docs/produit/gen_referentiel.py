# -*- coding: utf-8 -*-
"""Référentiel véhicules OXV — la classe est CALCULÉE, jamais saisie."""
import csv

MASSE_MAX = 2400
RATIO_MAX = 6.0

# marque, modele, generation, an_debut, an_fin, ch, kg, carrosserie, motorisation
D = [
("Abarth","595","Competizione",2012,2023,180,1035,"fermee","thermique"),
("Alfa Romeo","4C","960",2013,2020,240,1025,"fermee","thermique"),
("Alfa Romeo","Giulia","Quadrifoglio",2016,None,510,1620,"fermee","thermique"),
("Alpine","A110","Base",2017,None,252,1110,"fermee","thermique"),
("Alpine","A110","S",2019,None,300,1114,"fermee","thermique"),
("Alpine","A110","R",2022,None,300,1082,"fermee","thermique"),
("Aston Martin","Vantage","V8 2018",2018,None,510,1630,"fermee","thermique"),
("Audi","R8","4S V10",2015,None,570,1660,"fermee","thermique"),
("Audi","RS3","8V",2015,2020,367,1520,"fermee","thermique"),
("Audi","RS3","8Y",2021,None,400,1570,"fermee","thermique"),
("Audi","RS4","B9 Avant",2017,None,450,1790,"fermee","thermique"),
("Audi","RS6","C8 Avant",2019,None,600,2075,"fermee","thermique"),
("Audi","TT RS","8S",2016,2022,400,1450,"fermee","thermique"),
("Audi","RS e-tron GT","J1",2021,None,598,2347,"fermee","electrique"),
("BMW","M2","F87",2016,2021,370,1495,"fermee","thermique"),
("BMW","M2","G87",2023,None,460,1725,"fermee","thermique"),
("BMW","M3","E46",2000,2006,343,1570,"fermee","thermique"),
("BMW","M3","E92",2007,2013,420,1655,"fermee","thermique"),
("BMW","M3","F80",2014,2018,431,1595,"fermee","thermique"),
("BMW","M3","G80",2021,None,510,1730,"fermee","thermique"),
("BMW","M4","F82",2014,2020,431,1572,"fermee","thermique"),
("BMW","M5","F10",2011,2016,560,1870,"fermee","thermique"),
("BMW","M135i","F40",2019,None,306,1550,"fermee","thermique"),
("BMW","M240i","G42",2021,None,374,1690,"fermee","thermique"),
("BMW","Z4","M40i G29",2018,None,340,1610,"decouvrable","thermique"),
("Caterham","Seven","310",2017,None,152,540,"decouvrable","thermique"),
("Caterham","Seven","420",2017,None,210,560,"decouvrable","thermique"),
("Chevrolet","Corvette","C7 Stingray",2014,2019,466,1560,"fermee","thermique"),
("Cupra","Leon","VZ 300",2020,None,300,1450,"fermee","thermique"),
("Ferrari","458","Italia",2009,2015,570,1485,"fermee","thermique"),
("Ferrari","488","GTB",2015,2019,670,1475,"fermee","thermique"),
("Ferrari","F8","Tributo",2019,2023,720,1435,"fermee","thermique"),
("Ferrari","296","GTB",2022,None,830,1470,"fermee","hybride"),
("Ford","Mustang","VI GT V8",2015,2023,450,1740,"fermee","thermique"),
("Honda","Civic Type R","FK8",2017,2021,320,1380,"fermee","thermique"),
("Honda","Civic Type R","FL5",2022,None,329,1429,"fermee","thermique"),
("Honda","S2000","AP1 AP2",1999,2009,240,1260,"decouvrable","thermique"),
("Hyundai","i30 N","PD Performance",2017,None,275,1429,"fermee","thermique"),
("Jaguar","F-Type","R Coupe",2014,None,550,1730,"fermee","thermique"),
("Lamborghini","Gallardo","LP560-4",2008,2013,560,1430,"fermee","thermique"),
("Lamborghini","Huracan","LP610-4",2014,None,610,1422,"fermee","thermique"),
("Lotus","Elise","S2 111S",2004,2011,192,860,"decouvrable","thermique"),
("Lotus","Elise","S3 S 220",2011,2021,220,924,"decouvrable","thermique"),
("Lotus","Exige","S V6",2012,2021,350,1176,"fermee","thermique"),
("Lotus","Evora","S",2010,2021,350,1437,"fermee","thermique"),
("Lotus","Emira","V6",2022,None,405,1458,"fermee","thermique"),
("Mazda","MX-5","ND2",2018,None,184,1050,"decouvrable","thermique"),
("McLaren","570S","P13",2015,2021,570,1440,"fermee","thermique"),
("McLaren","720S","P14",2017,2023,720,1419,"fermee","thermique"),
("Mercedes-AMG","A45","W176",2015,2018,381,1480,"fermee","thermique"),
("Mercedes-AMG","A45 S","W177",2019,None,421,1550,"fermee","thermique"),
("Mercedes-AMG","C63 S","W205",2015,2021,510,1745,"fermee","thermique"),
("Mercedes-AMG","GT","C190",2015,2021,476,1615,"fermee","thermique"),
("Mini","John Cooper Works","F56",2015,None,231,1275,"fermee","thermique"),
("Nissan","350Z","Z33",2003,2009,280,1530,"fermee","thermique"),
("Nissan","370Z","Z34",2009,2020,328,1520,"fermee","thermique"),
("Nissan","GT-R","R35",2008,None,570,1752,"fermee","thermique"),
("Peugeot","208","GTi 30th",2015,2019,208,1160,"fermee","thermique"),
("Peugeot","308","GTi 270",2015,2021,272,1205,"fermee","thermique"),
("Porsche","911","964 Carrera",1989,1994,250,1350,"fermee","thermique"),
("Porsche","911","993 Carrera",1994,1998,272,1370,"fermee","thermique"),
("Porsche","911","996 Carrera",1998,2004,300,1320,"fermee","thermique"),
("Porsche","911","996 GT3",1999,2005,360,1350,"fermee","thermique"),
("Porsche","911","997 Carrera S",2004,2012,355,1425,"fermee","thermique"),
("Porsche","911","997 GT3",2006,2011,415,1395,"fermee","thermique"),
("Porsche","911","991 Carrera S",2011,2019,420,1440,"fermee","thermique"),
("Porsche","911","991 GT3",2013,2019,500,1430,"fermee","thermique"),
("Porsche","911","992 Carrera",2019,None,385,1505,"fermee","thermique"),
("Porsche","911","992 GT3",2021,None,510,1418,"fermee","thermique"),
("Porsche","911","992 Turbo",2020,None,580,1640,"fermee","thermique"),
("Porsche","Boxster","986 S",1999,2004,252,1320,"decouvrable","thermique"),
("Porsche","Boxster","718",2016,None,300,1385,"decouvrable","thermique"),
("Porsche","Cayman","987 S",2005,2012,295,1350,"fermee","thermique"),
("Porsche","Cayman","981 S",2012,2016,325,1350,"fermee","thermique"),
("Porsche","Cayman","718",2016,None,300,1365,"fermee","thermique"),
("Porsche","Cayman","718 S",2016,None,350,1385,"fermee","thermique"),
("Porsche","Cayman","718 GTS 4.0",2020,None,400,1405,"fermee","thermique"),
("Porsche","Cayman","718 GT4",2019,None,420,1420,"fermee","thermique"),
("Porsche","Taycan","4S J1",2020,None,530,2220,"fermee","electrique"),
("Porsche","Taycan","Turbo S J1",2020,None,761,2320,"fermee","electrique"),
("Renault","Clio","IV RS Trophy",2015,2019,220,1204,"fermee","thermique"),
("Renault","Megane","IV RS 280",2018,2023,280,1430,"fermee","thermique"),
("Renault","Megane","IV RS Trophy",2019,2023,300,1430,"fermee","thermique"),
("Subaru","BRZ","ZD8",2021,None,234,1280,"fermee","thermique"),
("Tesla","Model 3","Performance",2019,None,510,1850,"fermee","electrique"),
("Tesla","Model S","Plaid",2021,None,1020,2190,"fermee","electrique"),
("Toyota","GR86","ZN8",2021,None,234,1280,"fermee","thermique"),
("Toyota","GR Yaris","XP210",2020,None,261,1280,"fermee","thermique"),
("Toyota","GR Supra","A90 3.0",2019,None,340,1520,"fermee","thermique"),
("Volkswagen","Golf","VII GTI Performance",2013,2020,245,1350,"fermee","thermique"),
("Volkswagen","Golf","VII R",2013,2020,310,1476,"fermee","thermique"),
("Volkswagen","Golf","VIII GTI Clubsport",2020,None,300,1462,"fermee","thermique"),
("Volkswagen","Golf","VIII R",2020,None,320,1551,"fermee","thermique"),
]

def classe(ratio, masse):
    if masse > MASSE_MAX: return None, "Masse superieure au plafond de 2 400 kg"
    if ratio > RATIO_MAX: return None, "Rapport poids-puissance superieur a 6,0 kg/ch"
    if ratio < 3.5: return "III", ""
    if ratio < 5.0: return "II", ""
    return "I", ""

rows, exclus = [], []
for m, mo, g, a1, a2, ch, kg, car, mot in D:
    r = round(kg/ch, 2)
    c, motif = classe(r, kg)
    rec = dict(marque=m, modele=mo, generation=g, annee_debut=a1,
               annee_fin=a2 or "", puissance_ch=ch, masse_kg=kg,
               ratio_kg_ch=f"{r:.2f}".replace(".", ","), classe=c or "",
               carrosserie=car, motorisation=mot,
               statut="actif" if c else "exclu", motif_exclusion=motif,
               revision="2026")
    (rows if c else exclus).append(rec)

rows.sort(key=lambda x: (x["classe"], x["marque"], x["modele"]))
champs = list(rows[0].keys())
with open("OXV_Referentiel_Vehicules_2026.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=champs, delimiter=";")
    w.writeheader()
    for r in rows + exclus: w.writerow(r)

from collections import Counter
c = Counter(r["classe"] for r in rows)
print(f"Entrees admises : {len(rows)} | exclues : {len(exclus)}")
print("Classe I :", c["I"], "| Classe II :", c["II"], "| Classe III :", c["III"])
print("Decouvrables :", sum(1 for r in rows if r["carrosserie"]=="decouvrable"))
print("Electrifies :", sum(1 for r in rows if r["motorisation"] in ("electrique","hybride")))
for r in exclus: print("  exclu :", r["marque"], r["modele"], r["generation"], "-", r["motif_exclusion"])
