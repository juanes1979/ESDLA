"""
Script to add gems to equipment catalog
Based on the user-provided gem table
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

# Gemas Preciosas (mp = monedas de plata, mo = monedas de oro)
GEMAS_PRECIOSAS = [
    {"nombre": "Alejandrita", "precio": 8.4, "moneda": "mp"},
    {"nombre": "Almandina", "precio": 3, "moneda": "mp"},
    {"nombre": "Ámbar", "precio": 9, "moneda": "mp"},
    {"nombre": "Amatista", "precio": 3, "moneda": "mp"},
    {"nombre": "Andalucita", "precio": 14, "moneda": "mo"},
    {"nombre": "Andradita, verde", "precio": 3.4, "moneda": "mp"},
    {"nombre": "Andradita, roja", "precio": 4, "moneda": "mp"},
    {"nombre": "Andradita, amarillenta", "precio": 2, "moneda": "mp"},
    {"nombre": "Aguamarina", "precio": 1.4, "moneda": "mo"},
    {"nombre": "Aragonito, rosa", "precio": 3, "moneda": "mp"},
    {"nombre": "Aragonito, blanco", "precio": 1.8, "moneda": "mp"},
    {"nombre": "Aragonito, amarillo", "precio": 1.4, "moneda": "mp"},
    {"nombre": "Brasilianita", "precio": 2, "moneda": "mp"},
    {"nombre": "Californita", "precio": 2.8, "moneda": "mp"},
    {"nombre": "Cornalina", "precio": 1.5, "moneda": "mp"},
    {"nombre": "Cathoblóng", "precio": 3.7, "moneda": "mp"},
    {"nombre": "Hercinita", "precio": 2.8, "moneda": "mp"},
    {"nombre": "Cromoespinela", "precio": 2, "moneda": "mp"},
    {"nombre": "Crisoberilo, marrón", "precio": 1, "moneda": "mp"},
    {"nombre": "Crisoberilo, dorado-amarillo", "precio": 4, "moneda": "mp"},
    {"nombre": "Crisoberilo, verde oliva", "precio": 2.4, "moneda": "mp"},
    {"nombre": "Crisoberilo, amarillo marrón", "precio": 1.5, "moneda": "mp"},
    {"nombre": "Crisoberilo, amarillo verdoso", "precio": 1, "moneda": "mp"},
    {"nombre": "Cristalita, marrón", "precio": 5, "moneda": "mp"},
    {"nombre": "Cristalita, verde", "precio": 1.4, "moneda": "mo"},
    {"nombre": "Cristalita, blanca", "precio": 3, "moneda": "mp"},
    {"nombre": "Crisoprasa", "precio": 5.6, "moneda": "mp"},
    {"nombre": "Citrino", "precio": 3, "moneda": "mp"},
    {"nombre": "Coral, rojo", "precio": 5, "moneda": "mp"},
    {"nombre": "Cimofana, marrón", "precio": 1.5, "moneda": "mp"},
    {"nombre": "Cimofana, verde", "precio": 4, "moneda": "mp"},
    {"nombre": "Cimofana, amarilla", "precio": 3.2, "moneda": "mp"},
    {"nombre": "Diamante, negro", "precio": 4, "moneda": "mp"},
    {"nombre": "Diamante, azul", "precio": 13.6, "moneda": "mo"},
    {"nombre": "Diamante, marrón", "precio": 6, "moneda": "mp"},
    {"nombre": "Diamante, incoloro", "precio": 15, "moneda": "mo"},
    {"nombre": "Diamante, verde", "precio": 6, "moneda": "mo"},
    {"nombre": "Diamante, gris", "precio": 4, "moneda": "mo"},
    {"nombre": "Diamante, rojo", "precio": 12, "moneda": "mo"},
    {"nombre": "Diamante, amarillo", "precio": 8, "moneda": "mp"},
    {"nombre": "Dravita", "precio": 4, "moneda": "mp"},
    {"nombre": "Elbaíta, verde esmeralda", "precio": 6, "moneda": "mp"},
    {"nombre": "Elbaíta, verde pálido", "precio": 3.5, "moneda": "mp"},
    {"nombre": "Esmeralda", "precio": 6, "moneda": "mo"},
    {"nombre": "Goshenita", "precio": 4, "moneda": "mp"},
    {"nombre": "Heliodoro", "precio": 3.6, "moneda": "mp"},
    {"nombre": "Heliotropo", "precio": 1.6, "moneda": "mp"},
    {"nombre": "Hialina", "precio": 4.2, "moneda": "mp"},
    {"nombre": "Jadeíta", "precio": 1.5, "moneda": "mp"},
    {"nombre": "Jaspe, verde", "precio": 3.2, "moneda": "mp"},
    {"nombre": "Jaspe, rojo", "precio": 4.2, "moneda": "mp"},
    {"nombre": "Azabache", "precio": 2, "moneda": "mp"},
    {"nombre": "Kornerupina", "precio": 3, "moneda": "mp"},
    {"nombre": "Kainita, verde", "precio": 1.5, "moneda": "mp"},
    {"nombre": "Kainita, azul pálido", "precio": 2, "moneda": "mp"},
    {"nombre": "Nefrita", "precio": 3.5, "moneda": "mp"},
    {"nombre": "Ópalo, negro", "precio": 5, "moneda": "mp"},
    {"nombre": "Ópalo, rojo fuego", "precio": 4, "moneda": "mo"},
    {"nombre": "Ópalo, arlequín", "precio": 8, "moneda": "mo"},
    {"nombre": "Ópalo, blanco", "precio": 2.8, "moneda": "mp"},
    {"nombre": "Padparadscha", "precio": 5.6, "moneda": "mo"},
    {"nombre": "Perla, negra", "precio": 1.4, "moneda": "mo"},
    {"nombre": "Perla, azul", "precio": 5, "moneda": "mp"},
    {"nombre": "Perla, bronce", "precio": 5, "moneda": "mp"},
    {"nombre": "Perla, gris", "precio": 2.8, "moneda": "mp"},
    {"nombre": "Perla, rosa", "precio": 5, "moneda": "mp"},
    {"nombre": "Perla, blanca", "precio": 7, "moneda": "mp"},
    {"nombre": "Perla, amarilla", "precio": 2.8, "moneda": "mp"},
    {"nombre": "Plasma", "precio": 3, "moneda": "mp"},
    {"nombre": "Prasiolita", "precio": 4, "moneda": "mp"},
    {"nombre": "Piropos, rojo sangre", "precio": 4, "moneda": "mp"},
    {"nombre": "Piropos, rojo anaranjado", "precio": 1.2, "moneda": "mp"},
    {"nombre": "Piropos, púrpura", "precio": 2, "moneda": "mp"},
    {"nombre": "Rubí", "precio": 19.6, "moneda": "mo"},
    {"nombre": "Zafiro, azul", "precio": 8.4, "moneda": "mp"},
    {"nombre": "Zafiro, marrón", "precio": 1.4, "moneda": "mp"},
    {"nombre": "Zafiro, verde", "precio": 6, "moneda": "mo"},
    {"nombre": "Zafiro, violeta", "precio": 5, "moneda": "mo"},
    {"nombre": "Zafiro, amarillo", "precio": 3.7, "moneda": "mo"},
    {"nombre": "Sardonia", "precio": 3, "moneda": "mp"},
    {"nombre": "Chorló", "precio": 2, "moneda": "mp"},
    {"nombre": "Espesartina, roja", "precio": 1.2, "moneda": "mp"},
    {"nombre": "Espinela, azul", "precio": 2, "moneda": "mp"},
    {"nombre": "Espinela, azul verdosa", "precio": 4.6, "moneda": "mp"},
    {"nombre": "Espinela, verde", "precio": 8, "moneda": "mp"},
    {"nombre": "Espinela, roja", "precio": 8, "moneda": "mp"},
    {"nombre": "Espinela, violeta", "precio": 7.3, "moneda": "mp"},
    {"nombre": "Espodumena, verde", "precio": 2, "moneda": "mp"},
    {"nombre": "Titanita", "precio": 3, "moneda": "mp"},
    {"nombre": "Topacio, azul", "precio": 9.2, "moneda": "mp"},
    {"nombre": "Topacio, incoloro", "precio": 13, "moneda": "mp"},
    {"nombre": "Topacio, verdoso", "precio": 4.3, "moneda": "mp"},
    {"nombre": "Topacio, gris", "precio": 3, "moneda": "mp"},
    {"nombre": "Topacio, amarillo miel", "precio": 3.5, "moneda": "mp"},
    {"nombre": "Topacio, rosa", "precio": 9.4, "moneda": "mp"},
    {"nombre": "Topacio, púrpura", "precio": 13, "moneda": "mp"},
    {"nombre": "Topacio, rojizo", "precio": 1.8, "moneda": "mp"},
    {"nombre": "Topacio, tigre", "precio": 3.8, "moneda": "mp"},
    {"nombre": "Topacio, amarillo brillante", "precio": 5.6, "moneda": "mp"},
    {"nombre": "Tsilaisita", "precio": 3.6, "moneda": "mp"},
    {"nombre": "Uvarovita", "precio": 3.6, "moneda": "mp"},
    {"nombre": "Vorobieviita", "precio": 5.46, "moneda": "mo"},
]

# Gemas Semipreciosas (mb = monedas de bronce/cobre mayor, mc = monedas de cobre)
GEMAS_SEMIPRECIOSAS = [
    {"nombre": "Aventurina", "precio": 9, "moneda": "mb"},
    {"nombre": "Agalmatolita", "precio": 6, "moneda": "mc"},
    {"nombre": "Ágata", "precio": 7, "moneda": "mb"},
    {"nombre": "Alabastro, marrón", "precio": 7, "moneda": "mc"},
    {"nombre": "Alabastro, rosa", "precio": 13, "moneda": "mc"},
    {"nombre": "Alabastro, blanco", "precio": 3.4, "moneda": "mc"},
    {"nombre": "Amazonita", "precio": 8, "moneda": "mb"},
    {"nombre": "Andradita, negra", "precio": 7, "moneda": "mb"},
    {"nombre": "Andradita, marrón", "precio": 6, "moneda": "mb"},
    {"nombre": "Andradita, rojo marrón", "precio": 5, "moneda": "mb"},
    {"nombre": "Apatito, azul", "precio": 3.6, "moneda": "mc"},
    {"nombre": "Apatito, marrón", "precio": 7, "moneda": "mc"},
    {"nombre": "Apatito, verde", "precio": 5, "moneda": "mc"},
    {"nombre": "Apatito, violeta", "precio": 2.5, "moneda": "mc"},
    {"nombre": "Apatito, blanco", "precio": 1, "moneda": "mc"},
    {"nombre": "Axinita, azul", "precio": 8, "moneda": "mc"},
    {"nombre": "Axinita, marrón", "precio": 3, "moneda": "mc"},
    {"nombre": "Axinita, amarillo miel", "precio": 5.6, "moneda": "mc"},
    {"nombre": "Axinita, púrpura", "precio": 6.4, "moneda": "mc"},
    {"nombre": "Azurita", "precio": 1.7, "moneda": "mb"},
    {"nombre": "Azurmálquita", "precio": 1.4, "moneda": "mb"},
    {"nombre": "Benitoita", "precio": 4.7, "moneda": "mb"},
    {"nombre": "Casiterita", "precio": 5, "moneda": "mc"},
    {"nombre": "Charoita", "precio": 1.3, "moneda": "mc"},
    {"nombre": "Coral, negro", "precio": 9, "moneda": "mb"},
    {"nombre": "Coral, rosa", "precio": 2, "moneda": "mb"},
    {"nombre": "Coral, blanco", "precio": 9, "moneda": "mb"},
    {"nombre": "Crisocola, azul verdoso", "precio": 2, "moneda": "mc"},
    {"nombre": "Crisocola, verde", "precio": 1.3, "moneda": "mc"},
    {"nombre": "Crisocola, turquesa", "precio": 3.5, "moneda": "mc"},
    {"nombre": "Cordierita", "precio": 8, "moneda": "mc"},
    {"nombre": "Cuprita", "precio": 9, "moneda": "mb"},
    {"nombre": "Danburita", "precio": 7, "moneda": "mb"},
    {"nombre": "Diópsido", "precio": 6, "moneda": "mb"},
    {"nombre": "Dioptasa, azul", "precio": 8, "moneda": "mb"},
    {"nombre": "Dioptasa, verde", "precio": 6, "moneda": "mb"},
    {"nombre": "Dumortierita", "precio": 5, "moneda": "mc"},
    {"nombre": "Fluorita, verde", "precio": 3, "moneda": "mc"},
    {"nombre": "Fluorita, naranja", "precio": 4, "moneda": "mc"},
    {"nombre": "Fluorita, púrpura", "precio": 9, "moneda": "mc"},
    {"nombre": "Fluorita, blanca", "precio": 1.3, "moneda": "mc"},
    {"nombre": "Grosular", "precio": 8.3, "moneda": "mb"},
    {"nombre": "Hematites", "precio": 1.7, "moneda": "mb"},
    {"nombre": "Jacinto", "precio": 3.4, "moneda": "mc"},
    {"nombre": "Hidrofana", "precio": 4, "moneda": "mb"},
    {"nombre": "Jaspe, marrón", "precio": 3, "moneda": "mb"},
    {"nombre": "Jaspe, gris", "precio": 7, "moneda": "mb"},
    {"nombre": "Jaspe, ocre", "precio": 5, "moneda": "mb"},
    {"nombre": "Kainita, incolora", "precio": 8, "moneda": "mb"},
    {"nombre": "Kainita, blanco", "precio": 5, "moneda": "mb"},
    {"nombre": "Kainita, gris amarillento", "precio": 3, "moneda": "mb"},
    {"nombre": "Kainita, azul", "precio": 9, "moneda": "mb"},
    {"nombre": "Lapislázuli", "precio": 2.8, "moneda": "mb"},
    {"nombre": "Lazurita", "precio": 1.4, "moneda": "mb"},
    {"nombre": "Lepidolita, rosa", "precio": 3.4, "moneda": "mb"},
    {"nombre": "Lepidolita, púrpura", "precio": 8.3, "moneda": "mb"},
    {"nombre": "Malaquita", "precio": 5, "moneda": "mb"},
    {"nombre": "Marcasita", "precio": 1.3, "moneda": "mc"},
    {"nombre": "Marcenita", "precio": 5.4, "moneda": "mb"},
    {"nombre": "Moldavita", "precio": 9.5, "moneda": "mb"},
    {"nombre": "Piedra de Luna", "precio": 8, "moneda": "mb"},
    {"nombre": "Morión", "precio": 6.3, "moneda": "mb"},
    {"nombre": "Natrolita, amarilla", "precio": 3.4, "moneda": "mc"},
    {"nombre": "Natrolita, incolora", "precio": 4.6, "moneda": "mc"},
    {"nombre": "Obsidiana, negra", "precio": 1.2, "moneda": "mb"},
    {"nombre": "Obsidiana, marrón", "precio": 7, "moneda": "mb"},
    {"nombre": "Obsidiana, gris", "precio": 9.3, "moneda": "mc"},
    {"nombre": "Obsidiana, roja", "precio": 2.4, "moneda": "mb"},
    {"nombre": "Ópalo, musgoso", "precio": 8, "moneda": "mb"},
    {"nombre": "Ópalo, perlado", "precio": 7.3, "moneda": "mb"},
    {"nombre": "Ópalo, madera", "precio": 3.5, "moneda": "mb"},
    {"nombre": "Ortoclasa", "precio": 3.4, "moneda": "mb"},
    {"nombre": "Fenaquita, rosa", "precio": 4.8, "moneda": "mb"},
    {"nombre": "Fenaquita, incolora", "precio": 4, "moneda": "mb"},
    {"nombre": "Prehnita, verde manzana", "precio": 5, "moneda": "mc"},
    {"nombre": "Prehnita, marrón", "precio": 3.4, "moneda": "mc"},
    {"nombre": "Prehnita, amarillo verdoso", "precio": 7.6, "moneda": "mc"},
    {"nombre": "Pirita", "precio": 5, "moneda": "mb"},
    {"nombre": "Rodolita", "precio": 8.4, "moneda": "mb"},
    {"nombre": "Cristal de Roca", "precio": 3.6, "moneda": "mb"},
    {"nombre": "Cuarzo Rosa", "precio": 5, "moneda": "mb"},
    {"nombre": "Rutilo", "precio": 4.8, "moneda": "mb"},
    {"nombre": "Sagenita", "precio": 3.4, "moneda": "mb"},
    {"nombre": "Cuarzo Azul", "precio": 9.3, "moneda": "mb"},
    {"nombre": "Sepiolita", "precio": 4, "moneda": "mb"},
    {"nombre": "Serpentina", "precio": 3.8, "moneda": "mb"},
    {"nombre": "Esfalerita, marrón", "precio": 4.5, "moneda": "mb"},
    {"nombre": "Silimanita, azul", "precio": 7.4, "moneda": "mb"},
    {"nombre": "Silimanita, verde", "precio": 8.5, "moneda": "mb"},
    {"nombre": "Smithsonita, azul", "precio": 1.5, "moneda": "mc"},
    {"nombre": "Smithsonita, verde pálido", "precio": 3.4, "moneda": "mb"},
    {"nombre": "Smithsonita, rosa", "precio": 6.4, "moneda": "mb"},
    {"nombre": "Cuarzo Ahumado", "precio": 6.4, "moneda": "mb"},
    {"nombre": "Sodalita, azul intenso", "precio": 3.2, "moneda": "mb"},
    {"nombre": "Sodalita, lavanda", "precio": 3.4, "moneda": "mb"},
    {"nombre": "Espesartina, marrón", "precio": 5, "moneda": "mb"},
    {"nombre": "Espesartina, amarilla", "precio": 8.5, "moneda": "mb"},
    {"nombre": "Esfalerita, amarilla", "precio": 1.2, "moneda": "mb"},
    {"nombre": "Espodumena, incolora", "precio": 9.4, "moneda": "mb"},
    {"nombre": "Espodumena, violeta", "precio": 7.3, "moneda": "mb"},
    {"nombre": "Espodumena, amarilla", "precio": 8.4, "moneda": "mb"},
    {"nombre": "Estaurolita", "precio": 5, "moneda": "mb"},
    {"nombre": "Piedra Solar", "precio": 8.4, "moneda": "mb"},
    {"nombre": "Thomsonita, marrón", "precio": 3.2, "moneda": "mc"},
    {"nombre": "Thomsonita, verde", "precio": 7.6, "moneda": "mc"},
    {"nombre": "Thomsonita, roja", "precio": 8.4, "moneda": "mc"},
    {"nombre": "Thomsonita, blanca", "precio": 7.4, "moneda": "mc"},
    {"nombre": "Thomsonita, amarilla", "precio": 6.7, "moneda": "mc"},
    {"nombre": "Ojo de Tigre", "precio": 8, "moneda": "mc"},
    {"nombre": "Turquesa", "precio": 1.2, "moneda": "mb"},
    {"nombre": "Uvita", "precio": 8.4, "moneda": "mb"},
    {"nombre": "Variscita", "precio": 9.4, "moneda": "mb"},
    {"nombre": "Vesuvianita, azul", "precio": 6.3, "moneda": "mb"},
    {"nombre": "Vesuvianita, marrón", "precio": 5.4, "moneda": "mb"},
    {"nombre": "Vesuvianita, incolora", "precio": 3.2, "moneda": "mb"},
    {"nombre": "Vesuvianita, verde", "precio": 3.4, "moneda": "mb"},
    {"nombre": "Vesuvianita, roja", "precio": 3.8, "moneda": "mb"},
    {"nombre": "Vesuvianita, amarilla", "precio": 5.4, "moneda": "mb"},
    {"nombre": "Wardita", "precio": 3.2, "moneda": "mb"},
    {"nombre": "Zoisita, azul", "precio": 7.4, "moneda": "mc"},
    {"nombre": "Zoisita, marrón", "precio": 2.5, "moneda": "mc"},
    {"nombre": "Zoisita, verdosa", "precio": 7.4, "moneda": "mc"},
    {"nombre": "Zoisita, gris blancuzca", "precio": 2.5, "moneda": "mc"},
    {"nombre": "Zoisita, rosa", "precio": 8.5, "moneda": "mc"},
    {"nombre": "Zircónita, incolora", "precio": 9.3, "moneda": "mb"},
    {"nombre": "Zircónita, verde", "precio": 9.5, "moneda": "mb"},
    {"nombre": "Zircónita, gris", "precio": 6.4, "moneda": "mb"},
    {"nombre": "Zircónita, roja", "precio": 6.4, "moneda": "mb"},
    {"nombre": "Zircónita, roja marrón", "precio": 5.2, "moneda": "mb"},
    {"nombre": "Zircónita, amarilla", "precio": 7.8, "moneda": "mb"},
]


async def add_gems_to_equipment():
    """Add gems to the equipment catalog"""
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'test_database')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Get current catalog
        catalog = await db.equipment_catalog.find_one({"_id": "main"})
        if not catalog:
            catalog = await db.equipment_catalog.find_one({})
        
        if not catalog:
            print("No equipment catalog found. Creating new one with gems...")
            catalog = {"_id": "main"}
        
        # Add gems to catalog
        catalog["gemas_preciosas"] = GEMAS_PRECIOSAS
        catalog["gemas_semipreciosas"] = GEMAS_SEMIPRECIOSAS
        
        # Update or insert
        await db.equipment_catalog.update_one(
            {"_id": "main"},
            {"$set": {
                "gemas_preciosas": GEMAS_PRECIOSAS,
                "gemas_semipreciosas": GEMAS_SEMIPRECIOSAS
            }},
            upsert=True
        )
        
        print(f"Added {len(GEMAS_PRECIOSAS)} precious gems")
        print(f"Added {len(GEMAS_SEMIPRECIOSAS)} semi-precious gems")
        print("Gems successfully added to equipment catalog!")
        
    except Exception as e:
        print(f"Error adding gems: {e}")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(add_gems_to_equipment())
