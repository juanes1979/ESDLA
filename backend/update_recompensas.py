#!/usr/bin/env python3
"""
Script to update recompensas collection with complete data from PDF extraction
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

RECOMPENSAS_DATA = {
    "_id": "main",
    "info_general": {
        "descripcion": "Las recompensas son piezas de equipo de guerra de artesanía superior, concedidas a un héroe como premio por sus hazañas. Representan características de armas y equipos defensivos de alta calidad.",
        "cuando_elegir": "Los personajes eligen una primera recompensa al alcanzar el nivel 3, y de nuevo en los niveles 5, 7 y 9.",
        "interpretacion": "Los jugadores deben decidir si una recompensa representa el descubrimiento de una propiedad previamente desconocida de un objeto, o si se trata de un arma o armadura completamente nueva. Se recomienda integrar la decisión en una narrativa.",
        "aplicacion": "Cada mejora puede aplicarse solo una vez a cada pieza de equipo. El objeto no puede ser un arma o armadura famosa.",
        "inmunidad_argumental": "Los objetos mejorados con recompensas gozan de cierto grado de 'inmunidad argumental' y nunca deben perderse, romperse o ser arrebatados temporalmente. Tampoco pueden entregarse a otros héroes, ni siquiera en caso de muerte del personaje.",
        "prestamo": "Si la compañía está de acuerdo, un héroe puede pedir prestado un objeto a un compañero gastando 1 punto de Comunidad."
    },
    "mejoras": [
        {
            "id": "afilada",
            "nombre": "AFILADA",
            "tipo": "ARMA",
            "tipos_aplicables": ["arma_cuerpo_cuerpo", "arma_distancia"],
            "descripcion": "Afilada o mejor equilibrada, esta arma tiene ahora más probabilidades de producir un impacto crítico al golpear a su objetivo.",
            "efecto_mecanico": "Los ataques con esta arma obtienen un impacto crítico con una tirada de 19 a 20.",
            "efecto_adicional_anillo_unico": "Si se usa un juego de dados de éxito de 'El Anillo Único', un arma Afilada también consigue un impacto crítico cuando se obtienen dos o más resultados de 5, o tres resultados de 5 si hay desventaja.",
            "restricciones": None
        },
        {
            "id": "ajustada",
            "nombre": "AJUSTADA",
            "tipo": "ARMADURA",
            "tipos_aplicables": ["armadura_ligera", "armadura_media", "armadura_pesada"],
            "descripcion": "Un hábil herrero ha hecho que esta armadura sea más difícil de superar con impactos críticos.",
            "efecto_mecanico": "Mientras llevas puesta esta armadura, cualquier impacto crítico contra ti se convierte en un impacto normal.",
            "efecto_adicional_anillo_unico": None,
            "restricciones": None
        },
        {
            "id": "cruel",
            "nombre": "CRUEL",
            "tipo": "ARMA",
            "tipos_aplicables": ["arma_cuerpo_cuerpo", "municion"],
            "descripcion": "Un impacto crítico de esta dura y firme arma es más peligroso.",
            "efecto_mecanico": "Cuando consigues un impacto crítico con esta arma, puedes tirar dos dados de daño de arma más y añadirlos al daño adicional.",
            "efecto_adicional_anillo_unico": None,
            "restricciones": "No se puede aplicar a un arma que tenga la propiedad 'munición'. Sí se puede aplicar a una pieza de munición."
        },
        {
            "id": "dolorosa",
            "nombre": "DOLOROSA",
            "tipo": "ARMA",
            "tipos_aplicables": ["arma_cuerpo_cuerpo", "arma_distancia"],
            "descripcion": "El arma es fuerte y pesada, infligiendo más daño a sus objetivos.",
            "efecto_mecanico": "Obtienes una bonificación de +1 a las tiradas de daño con esta arma.",
            "efecto_adicional_anillo_unico": None,
            "restricciones": None
        },
        {
            "id": "habilmente_fabricada",
            "nombre": "HÁBILMENTE FABRICADA",
            "tipo": "ARMADURA",
            "tipos_aplicables": ["armadura_ligera", "armadura_media", "armadura_pesada"],
            "descripcion": "Un artesano competente ha conseguido que esta armadura sea más ligera o menos engorrosa que sus homólogas de menor calidad.",
            "efecto_mecanico": "La armadura pesa la mitad de lo normal. Si normalmente impone desventaja en las tiradas de salvación de fatiga, esta versión no lo hace. El modificador por Destreza máximo que puedes sumar a tu CA cuando la llevas puesta aumenta en 1.",
            "efecto_adicional_anillo_unico": None,
            "restricciones": None
        },
        {
            "id": "reforzado",
            "nombre": "REFORZADO",
            "tipo": "ESCUDO",
            "tipos_aplicables": ["escudo"],
            "descripcion": "La estructura del escudo está reforzada, posiblemente con un borde de metal o un umbo de hierro más grande, lo que permite a su portador parar los golpes con mayor facilidad.",
            "efecto_mecanico": "Mientras llevas este escudo embrazado, tienes un bonificador de +1 a la CA. Este bonificador se suma al bonificador normal del escudo a la CA.",
            "efecto_adicional_anillo_unico": None,
            "restricciones": None
        }
    ],
    "niveles_recompensa": [
        {"nivel": 3, "recompensas": 1, "descripcion": "Primera recompensa disponible"},
        {"nivel": 5, "recompensas": 1, "descripcion": "Segunda recompensa disponible"},
        {"nivel": 7, "recompensas": 1, "descripcion": "Tercera recompensa disponible"},
        {"nivel": 9, "recompensas": 1, "descripcion": "Cuarta recompensa disponible"}
    ],
    "bendiciones": {
        "descripcion": "Los objetos que se envuelven con poderosos encantamientos (llamados bendiciones, mejoras a las habilidades del personaje que lleva el objeto en cuestión). Un objeto que tiene una bendición se llama artefacto maravilloso. Las bendiciones pueden otorgarse mediante el Arte de la fabricación o pueden encontrarse en tesoros antiguos. Un artefacto maravilloso solo puede tener una bendición activa a la vez.",
        "bonificador_competencia": {
            "descripcion": "Según el nivel del personaje que imparte la bendición al objeto, se tirará un dado y el resultado será el modificador a dicha bendición.",
            "tabla": [
                {"nivel": "1-4", "dado": "1d4"},
                {"nivel": "5-8", "dado": "1d6"},
                {"nivel": "9-12", "dado": "1d8"},
                {"nivel": "13-16", "dado": "1d10"},
                {"nivel": "17-20", "dado": "1d12"}
            ]
        }
    },
    "armas_con_nombre": {
        "descripcion": "Los guerreros y aventureros suelen poner nombre al equipo de guerra que demuestra su valía. Esto es más común con las espadas y las lanzas, más raro con los cascos y los escudos, y casi desconocido con las armaduras.",
        "tradiciones": [
            {"cultura": "Elfos y Hombres", "descripcion": "Siguen tradiciones similares, concediendo títulos a sus armas que glorifican su eficacia en la batalla. Las armas con nombres más elevados o poéticos suelen ser objetos de linaje más noble o de mayor antigüedad, raramente entregados como recompensa."},
            {"cultura": "Hombres de Bardo", "descripcion": "Las armas valiosas son tan apreciadas que a menudo apodan a sus hijos e hijas con nombres de una pieza de equipo de guerra."},
            {"cultura": "Dúnedain", "descripcion": "Atesoran sus antiguas espadas y las transmiten a través de generaciones de guerreros."},
            {"cultura": "Hobbits y Habitantes de las Tierras de Bree", "descripcion": "Rara vez dan títulos a sus armas. Si lo hacen, probablemente sea porque el objeto les ha salvado la vida. Suelen elegir nombres sencillos tomados de la vida cotidiana."},
            {"cultura": "Enanos", "descripcion": "Nunca dan nombre a sus armas, ni siquiera a los artefactos de renombre. Es posible que sí den un título a sus armas, pero lo mantengan en secreto."}
        ]
    }
}


async def update_recompensas():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Upsert the complete data
    result = await db.recompensas.replace_one(
        {"_id": "main"},
        RECOMPENSAS_DATA,
        upsert=True
    )
    
    print(f"Recompensas updated: modified={result.modified_count}, upserted={result.upserted_id is not None}")
    
    # Verify
    data = await db.recompensas.find_one({"_id": "main"})
    print(f"Verified: {len(data.get('mejoras', []))} mejoras loaded")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(update_recompensas())
