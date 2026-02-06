"""
Script to update the MONTURAS section with complete data from user-provided image
Also extracts data from Sombra, Artes, and Recompensas sheets
"""
import openpyxl
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

def safe_str(val, max_len=500):
    if val is None:
        return ""
    return str(val)[:max_len].strip()

def safe_float(val):
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None

def safe_int(val):
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None

async def update_monturas_from_image():
    """Update monturas collection with complete data from user's image"""
    
    # Complete monturas data from user's image
    monturas_data = [
        {"nombre": "Burro", "precio": 8, "moneda": "mp", "capacidad_carga": 190, "constitucion": "13 (+1)", "velocidad": 12, "capacidad_pequeno": True, "capacidad_mediano": False},
        {"nombre": "Caballo de caminos", "precio": 20, "moneda": "mp", "capacidad_carga": 150, "constitucion": "11 (+0)", "velocidad": 14, "capacidad_pequeno": False, "capacidad_mediano": True},
        {"nombre": "Caballo de carga", "precio": 50, "moneda": "mp", "capacidad_carga": 243, "constitucion": "13 (+1)", "velocidad": 12, "capacidad_pequeno": False, "capacidad_mediano": True},
        {"nombre": "Caballo de guerra", "precio": 150, "moneda": "mp", "capacidad_carga": 263, "constitucion": "14 (+1)", "velocidad": 20, "capacidad_pequeno": False, "capacidad_mediano": True},
        {"nombre": "Caballo de Lothlórien", "precio": 70, "moneda": "mp", "capacidad_carga": 170, "constitucion": "13 (+1)", "velocidad": 17, "capacidad_pequeno": False, "capacidad_mediano": True},
        {"nombre": "Caballo de monta", "precio": 75, "moneda": "mp", "capacidad_carga": 216, "constitucion": "12 (+1)", "velocidad": 18, "capacidad_pequeno": False, "capacidad_mediano": True},
        {"nombre": "Caballo de Rohan", "precio": 90, "moneda": "mp", "capacidad_carga": 220, "constitucion": "13 (+1)", "velocidad": 19, "capacidad_pequeno": False, "capacidad_mediano": True},
        {"nombre": "Caballo Variag", "precio": 60, "moneda": "mp", "capacidad_carga": 210, "constitucion": "14 (+1)", "velocidad": 14, "capacidad_pequeno": False, "capacidad_mediano": True},
        {"nombre": "Camello", "precio": 50, "moneda": "mp", "capacidad_carga": 218, "constitucion": "13 (+1)", "velocidad": 15, "capacidad_pequeno": True, "capacidad_mediano": True},
        {"nombre": "Elefante", "precio": 5, "moneda": "mo", "capacidad_carga": 598, "constitucion": "13 (+1)", "velocidad": 12, "capacidad_pequeno": True, "capacidad_mediano": True},
        {"nombre": "Gran caballo de Rohan", "precio": 180, "moneda": "mp", "capacidad_carga": 260, "constitucion": "14 (+1)", "velocidad": 21, "capacidad_pequeno": False, "capacidad_mediano": True},
        {"nombre": "Mastín", "precio": 25, "moneda": "mp", "capacidad_carga": 88, "constitucion": "10 (+0)", "velocidad": 12, "capacidad_pequeno": True, "capacidad_mediano": False},
        {"nombre": "Poni", "precio": 12, "moneda": "mp", "capacidad_carga": 101, "constitucion": "13 (+1)", "velocidad": 12, "capacidad_pequeno": True, "capacidad_mediano": False},
        {"nombre": "Poni de montaña", "precio": 22, "moneda": "mp", "capacidad_carga": 140, "constitucion": "14 (+1)", "velocidad": 11, "capacidad_pequeno": True, "capacidad_mediano": False},
        {"nombre": "Poni robusto", "precio": 18, "moneda": "mp", "capacidad_carga": 130, "constitucion": "13 (+1)", "velocidad": 12, "capacidad_pequeno": True, "capacidad_mediano": False},
    ]
    
    # Update monturas in equipment_catalog
    await db.equipment_catalog.update_one(
        {"_id": "main"},
        {"$set": {"monturas": monturas_data}}
    )
    print(f"Updated monturas: {len(monturas_data)} items")
    return monturas_data

async def extract_sombra_data():
    """Extract shadow rules from Sombra sheet"""
    wb = openpyxl.load_workbook('/app/data/utumno.xlsm', data_only=True)
    ws = wb['Sombra']
    
    sombra_data = {
        "pavor": [],
        "avaricia": [],
        "fechorias": [],
        "estados": [],
        "sendas_sombra": []
    }
    
    # Pavor (rows 4-8)
    for row in range(5, 9):
        fuente = safe_str(ws.cell(row=row, column=1).value)
        ejemplo = safe_str(ws.cell(row=row, column=2).value)
        puntos = safe_str(ws.cell(row=row, column=3).value)
        if fuente:
            sombra_data["pavor"].append({
                "fuente": fuente,
                "ejemplo": ejemplo,
                "puntos_sombra": puntos
            })
    
    # Avaricia (rows 15-18)
    for row in range(15, 19):
        tesoro = safe_str(ws.cell(row=row, column=1).value)
        descripcion = safe_str(ws.cell(row=row, column=2).value)
        puntos = safe_str(ws.cell(row=row, column=3).value)
        if tesoro:
            sombra_data["avaricia"].append({
                "tesoro_magico": tesoro,
                "descripcion": descripcion,
                "puntos_sombra": puntos
            })
    
    # Fechorías (rows 24-28)
    for row in range(24, 29):
        accion = safe_str(ws.cell(row=row, column=1).value)
        puntos = safe_str(ws.cell(row=row, column=3).value)
        if accion:
            sombra_data["fechorias"].append({
                "accion": accion,
                "puntos_sombra": puntos
            })
    
    # Estados de la sombra
    sombra_data["estados"] = [
        {
            "nombre": "Desanimado",
            "condicion": "Puntos de sombra igualan o superan la mitad de Sabiduría",
            "efectos": [
                "-1 punto de compañía",
                "En tirada d20 saca un 1 o 2 la tirada falla irremediablemente"
            ]
        },
        {
            "nombre": "Angustiado",
            "condicion": "Puntos de sombra superan la puntuación de Sabiduría",
            "efectos": ["Brote de locura"]
        },
        {
            "nombre": "Locura",
            "condicion": "Brote de locura activado",
            "efectos": [
                "Ver origen de la última imposición de sombra",
                "Traición, miedo, huida, agresión verbal o física"
            ]
        }
    ]
    
    # Sendas de la sombra (rows 63-86)
    current_senda = None
    for row in range(63, 87):
        senda = safe_str(ws.cell(row=row, column=1).value)
        defecto = safe_str(ws.cell(row=row, column=2).value)
        descripcion = safe_str(ws.cell(row=row, column=3).value)
        efecto = safe_str(ws.cell(row=row, column=4).value)
        
        if senda:
            current_senda = senda
        
        if defecto and current_senda:
            sombra_data["sendas_sombra"].append({
                "senda": current_senda,
                "defecto": defecto,
                "descripcion": descripcion,
                "efecto_juego": efecto
            })
    
    # Save to MongoDB
    await db.sombra_rules.update_one(
        {"_id": "main"},
        {"$set": sombra_data},
        upsert=True
    )
    print(f"Extracted sombra data: {len(sombra_data['sendas_sombra'])} defectos")
    return sombra_data

async def extract_artes_data():
    """Extract arts from Artes sheet"""
    wb = openpyxl.load_workbook('/app/data/utumno.xlsm', data_only=True)
    ws = wb['Artes']
    
    artes = []
    for row in range(2, 10):
        nombre = safe_str(ws.cell(row=row, column=1).value)
        descripcion_corta = safe_str(ws.cell(row=row, column=2).value)
        descripcion = safe_str(ws.cell(row=row, column=3).value)
        
        if nombre:
            artes.append({
                "nombre": nombre,
                "descripcion_corta": descripcion_corta,
                "descripcion": descripcion
            })
    
    # Save to MongoDB
    await db.artes.delete_many({})
    if artes:
        await db.artes.insert_many(artes)
    print(f"Extracted artes: {len(artes)} items")
    return artes

async def extract_recompensas_data():
    """Extract rewards from Recompensas sheet"""
    wb = openpyxl.load_workbook('/app/data/utumno.xlsm', data_only=True)
    ws = wb['Recompensas']
    
    recompensas = {
        "mejoras_equipo": [],
        "niveles_recompensa": [],
        "bonificador_competencia": []
    }
    
    # Equipment upgrades (rows 3-8)
    for row in range(3, 9):
        tipo = safe_str(ws.cell(row=row, column=1).value)
        nombre = safe_str(ws.cell(row=row, column=2).value)
        efecto = safe_str(ws.cell(row=row, column=3).value)
        restricciones = safe_str(ws.cell(row=row, column=4).value)
        
        if tipo and nombre:
            recompensas["mejoras_equipo"].append({
                "tipo": tipo,
                "nombre": nombre,
                "efecto_mecanico": efecto,
                "restricciones": restricciones
            })
    
    # Reward levels (rows 11-14)
    for row in range(11, 15):
        nivel = safe_int(ws.cell(row=row, column=1).value)
        recompensa = safe_str(ws.cell(row=row, column=2).value)
        if nivel:
            recompensas["niveles_recompensa"].append({
                "nivel": nivel,
                "recompensa": recompensa
            })
    
    # Competence bonuses (rows 22-25+)
    for row in range(22, 30):
        nivel = safe_str(ws.cell(row=row, column=1).value)
        tirada = safe_str(ws.cell(row=row, column=2).value)
        if nivel and tirada:
            recompensas["bonificador_competencia"].append({
                "nivel": nivel,
                "tirada": tirada
            })
    
    # Save to MongoDB
    await db.recompensas.update_one(
        {"_id": "main"},
        {"$set": recompensas},
        upsert=True
    )
    print(f"Extracted recompensas: {len(recompensas['mejoras_equipo'])} mejoras")
    return recompensas

async def main():
    print("=== Updating game data ===\n")
    await update_monturas_from_image()
    await extract_sombra_data()
    await extract_artes_data()
    await extract_recompensas_data()
    print("\n=== Done! ===")

if __name__ == "__main__":
    asyncio.run(main())
