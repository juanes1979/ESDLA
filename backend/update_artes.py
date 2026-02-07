"""
Script to update Artes with complete data from the PDF
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv('.env')

def now_utc():
    return datetime.now(timezone.utc).isoformat()

ARTES_COMPLETAS = [
    {
        "nombre": "Arte de la Fabricación",
        "descripcion_corta": "Talento para fabricar cosas con habilidad y astucia superiores.",
        "descripcion": """Este arte no pretende abarcar toda la gama de aptitudes de los herreros, escultores y otros artesanos, sino que refleja un talento para fabricar cosas con habilidad y astucia superiores.

Durante una fase de comunidad, puedes gastar un espacio de arte y elegir un objeto no mágico que poseas. Debes dominar las herramientas relacionadas con el objeto que elijas, y puede que también necesites acceso a materiales o lugares especiales, como una forja. Si un rasgo te permite añadir el doble de tu bonificador por competencia con una herramienta, puedes elegir dos objetos relacionados con esa herramienta en lugar de uno.""",
        "requisitos": [
            "Dominar las herramientas relacionadas con el objeto que elijas",
            "Puede que necesites acceso a materiales o lugares especiales, como una forja"
        ],
        "opciones": [
            {
                "tipo": "Armadura o escudo",
                "efecto": "Se mejora con una recompensa.",
                "nivel_5": "La criatura también obtiene un bonificador de +1 a la Clase de Armadura mientras lleve la armadura puesta o el escudo embrazado."
            },
            {
                "tipo": "Arma",
                "efecto": "Se mejora con una recompensa. Si consigues un éxito mágico con las herramientas utilizadas, el arma también puede volverse mágica.",
                "nivel_5": "La criatura también obtiene un bonificador de +1 a las tiradas de ataque y daño realizadas con el arma."
            },
            {
                "tipo": "Cualquier otro objeto",
                "efecto": "Elige una habilidad relacionada de algún modo (ej. Sigilo para una capa, Atletismo para botas). Una criatura que tenga o lleve puesto el objeto obtiene un dado de bendición en las pruebas de característica que utilicen esa habilidad. Si consigues un éxito mágico con las herramientas utilizadas, el objeto puede convertirse en un artefacto maravilloso con una bendición que afecte a la habilidad elegida."
            }
        ],
        "reglas_especiales": [
            "Las opciones anteriores solo se pueden elegir una vez para cada objeto.",
            "No se puede recuperar un espacio de arte gastado de esta forma hasta la siguiente fase de comunidad, en la que se pueden retirar las bonificaciones otorgadas por este espacio y recuperarlo, si así se quiere."
        ]
    },
    {
        "nombre": "Arte de la Medicina",
        "descripcion_corta": "Eres hábil en la curación de heridas y enfermedades.",
        "descripcion": """Eres hábil, siguiendo antiguas tradiciones, en la curación de heridas y enfermedades.

Como acción, puedes gastar un espacio de arte para atender a una criatura situada a 5 pies (1,5 m) o menos de ti. Realiza una prueba de Inteligencia (Medicina) contra CD 10. Puedes gastar un uso de un equipo de sanador para reemplazar la tirada de d20 por un 10. Si tienes éxito, la criatura recupera un número de puntos de golpe igual al resultado de tu prueba menos 10 (mínimo 1 punto de golpe).""",
        "requisitos": [],
        "opciones": [
            {
                "tipo": "Curación básica",
                "efecto": "La criatura recupera un número de puntos de golpe igual al resultado de tu prueba menos 10 (mínimo 1 punto de golpe)."
            }
        ],
        "nivel_5": "Superando una prueba puedes curar al objetivo de una enfermedad o neutralizar un veneno que le afecte.",
        "reglas_especiales": [
            "Puedes gastar un uso de un equipo de sanador para reemplazar la tirada de d20 por un 10."
        ]
    },
    {
        "nombre": "Arte de la Oratoria",
        "descripcion_corta": "Eres estudiante de sindarin y quenya, la Lengua Antigua, y tienes ventaja en las pruebas de Carisma con elfos.",
        "descripcion": """Eres estudiante de sindarin y quenya, la Lengua Antigua, y tienes ventaja en las pruebas de Carisma cuando interactúas con elfos.

Como acción, puedes usar un espacio de arte y elegir una criatura que no sea un elfo, un Mago o una criatura de poder similar, que esté situada a 30 pies (9 m) o menos de ti y que pueda oírte.""",
        "requisitos": [
            "Ser estudiante de sindarin y quenya (la Lengua Antigua)"
        ],
        "opciones": [
            {
                "tipo": "Intimidación",
                "efecto": "Lleva a cabo una prueba de Carisma (Intimidación) enfrentada a una prueba de Carisma (Intimidación) del objetivo.",
                "exito": "El objetivo está asustado de ti durante 1 minuto. El objetivo asustado puede realizar una prueba de Carisma (Intimidación) contra tu puntuación pasiva de Carisma (Intimidación) al final de cada uno de sus turnos, terminando el efecto sobre sí mismo si tiene éxito.",
                "nota": "Un objetivo tiene ventaja en la prueba enfrentada si su tamaño es Grande o mayor, o si no puede entenderte."
            },
            {
                "tipo": "Orden",
                "efecto": "Lleva a cabo una prueba de Carisma (Intimidación) o Carisma (Persuasión) enfrentada a una prueba de Sabiduría (Perspicacia) del objetivo.",
                "exito": "Puedes pronunciar una orden de una sola palabra que el objetivo debe obedecer en su siguiente turno, si puede y si la orden no le perjudica directamente. Cuando el objetivo ha ejecutado la orden, termina su turno.",
                "ejemplos": ["«¡Cáete!» (el objetivo cae derribado)", "«¡Huye!» (el objetivo se aleja de ti)", "«¡Detente!» (el objetivo no se mueve y no realiza ninguna acción)"],
                "nota": "Un objetivo tiene ventaja en la prueba enfrentada si es inmune a ser hechizado o si no puede entenderte. El efecto puede considerarse una fechoría dependiendo de las circunstancias."
            }
        ],
        "nivel_5": "Puedes tener como objetivo una criatura adicional, o dos criaturas adicionales a nivel 9.",
        "reglas_especiales": []
    },
    {
        "nombre": "Arte de las Armas",
        "descripcion_corta": "Obtienes competencia y mejoras de ataque en un tipo de armas.",
        "descripcion": """Elige un tipo de arma. Obtienes competencia con esta arma si aún no la tienes.

Cuando atacas con ese tipo de arma y se trata de un arma sutil o a distancia, puedes utilizar tu modificador por Inteligencia, Sabiduría o Carisma en lugar de tu modificador por Fuerza o Destreza para las tiradas de ataque y daño. Debes utilizar el mismo modificador para ambas tiradas.

Además, cuando aciertas a una criatura con el arma elegida, puedes usar un espacio de arte para lanzar un número de dados de daño de arma adicionales en la tirada de daño. El número de dados de daño de arma adicionales es igual a tu bonificador por competencia.""",
        "requisitos": [
            "Elegir un tipo de arma"
        ],
        "opciones": [
            {
                "tipo": "Modificador alternativo",
                "efecto": "Puedes utilizar tu modificador por Inteligencia, Sabiduría o Carisma en lugar de tu modificador por Fuerza o Destreza para las tiradas de ataque y daño (solo con armas sutiles o a distancia)."
            },
            {
                "tipo": "Daño adicional",
                "efecto": "Puedes usar un espacio de arte para lanzar un número de dados de daño de arma adicionales igual a tu bonificador por competencia."
            }
        ],
        "reglas_especiales": []
    },
    {
        "nombre": "Arte de las Bestias",
        "descripcion_corta": "Obtienes la aptitud de comprender y comunicarte verbalmente con las bestias.",
        "descripcion": """Obtienes la aptitud de comprender y comunicarte verbalmente con las bestias.

El conocimiento y la conciencia de muchas bestias están limitados por su inteligencia, pero en general pueden darte información sobre lugares y criaturas cercanos, incluyendo cualquier cosa que puedan percibir o hayan percibido en el último día. Podrías persuadir a una bestia para que te haga un pequeño favor, a discreción del Maestro del saber, como entregar una carta o un mensaje verbal.

Como acción, puedes usar un espacio de arte y elegir una bestia a la que puedas ver y que esté a 30 pies (9 m) o menos de ti. Debe ser capaz de verte y oírte. Realiza una prueba de Sabiduría (Trato con animales), enfrentada a una prueba de Sabiduría (Perspicacia) del objetivo.""",
        "requisitos": [],
        "opciones": [
            {
                "tipo": "Comunicación",
                "efecto": "Puedes darte información sobre lugares y criaturas cercanos (lo que las bestias puedan percibir o hayan percibido en el último día)."
            },
            {
                "tipo": "Hechicar bestia",
                "efecto": "Realiza una prueba de Sabiduría (Trato con animales), enfrentada a una prueba de Sabiduría (Perspicacia) del objetivo.",
                "exito": "La bestia queda hechizada por ti durante 24 horas o hasta que tú o tus compañeros le causéis algún daño.",
                "exito_magico": "Si el objetivo es una bestia con un valor de desafío de 1/8 o inferior, puedes hacer que la bestia quede permanentemente hechizada por ti, hasta que la liberes, le causes daño o hagas que otra bestia quede permanentemente hechizada por ti."
            }
        ],
        "nivel_5": "Puedes afectar a una bestia adicional, o a dos bestias adicionales a nivel 9.",
        "reglas_especiales": [
            "Una bestia gana automáticamente la prueba si su puntuación de Inteligencia es 4 o superior."
        ]
    },
    {
        "nombre": "Arte de las Canciones",
        "descripcion_corta": "Has sido entrenado en el canto según la tradición de los juglares errantes.",
        "descripcion": """Has sido entrenado en el canto según la tradición de los juglares errantes. Tu sabiduría musical es más profunda que la de la mayoría, ya que participas de los conocimientos de los grandes cantantes de antaño.

Como acción, puedes gastar un espacio de arte y realizar una prueba de Carisma (Interpretación), enfrentada a una prueba de Inteligencia (Acertijos) de todas las criaturas a tu elección situadas a 30 pies (9 m) o menos de ti y que puedan oírte. Una criatura puede elegir fallar su prueba de característica si lo desea.""",
        "requisitos": [
            "Ser entrenado en el canto según la tradición de los juglares errantes"
        ],
        "opciones": [
            {
                "tipo": "Suprimir efectos",
                "efecto": "Puedes suprimir cualquier efecto que cause que el objetivo esté hechizado o asustado hasta el final de tu siguiente turno. Este efecto termina si el objetivo deja de oírte."
            },
            {
                "tipo": "Volver indiferente",
                "efecto": "Puedes hacer que el objetivo que es hostil se vuelva indiferente hacia las criaturas de tu elección hasta el final de tu siguiente turno. El objetivo también tiene desventaja en las pruebas de Sabiduría (Percepción) realizadas para percibir a cualquier criatura que no seas tú durante el mismo tiempo. Este efecto termina si el objetivo deja de oírte, si resulta herido o si presencia cómo se causa daño a alguno de sus amigos."
            },
            {
                "tipo": "Afectar tiradas",
                "efecto": "Hasta el final de tu siguiente turno, siempre que el objetivo realice una tirada de ataque o una tirada de salvación, debe tirar un d4 y sumar el número obtenido (si el objetivo es amistoso hacia ti) o restarlo (si el objetivo es hostil). Este efecto termina si el objetivo deja de oírte."
            }
        ],
        "nivel_5": "Puedes utilizar una acción adicional en cada uno de tus turnos para ampliar la duración de uno de estos efectos en todos los objetivos hasta el final de tu siguiente turno, hasta un máximo de 1 minuto.",
        "reglas_especiales": []
    },
    {
        "nombre": "Arte de las Runas",
        "descripcion_corta": "A partir de ahora eres capaz de leer y escribir inscripciones rúnicas.",
        "descripcion": """A partir de ahora eres capaz de leer y escribir inscripciones rúnicas. Puedes usar las runas para transmitir mensajes secretos a otras criaturas que las conozcan o a las que hayas instruido previamente sobre su significado.

Al final de un descanso corto o largo, puedes usar un espacio de arte y elegir un objeto mágico en posesión de la compañía. Lleva a cabo una prueba de Inteligencia (Saber antiguo). La CD es 10 para un artefacto maravilloso, 15 para un objeto extraordinario o 20 para un arma o armadura famosa. Si tienes éxito, descubres todo lo que hay que saber sobre las cualidades del objeto y si está maldito o no.

Durante una fase de comunidad, puedes usar un espacio de arte para inscribir runas de poder en un objeto no mágico de tu elección.""",
        "requisitos": [
            "Ser capaz de leer y escribir inscripciones rúnicas",
            "Debes tener competencia con las herramientas relacionadas con el material del que está hecho el objeto (ej. herramientas de herrería para el metal, herramientas de tallar madera para la madera)"
        ],
        "opciones": [
            {
                "tipo": "Leer runas",
                "efecto": "Puedes usar las runas para transmitir mensajes secretos a otras criaturas que las conozcan o a las que hayas instruido previamente sobre su significado."
            },
            {
                "tipo": "Descubrir cualidades de objetos",
                "efecto": "Al final de un descanso corto o largo, puedes usar un espacio de arte y elegir un objeto mágico. Prueba de Inteligencia (Saber antiguo): CD 10 (artefacto maravilloso), CD 15 (objeto extraordinario), CD 20 (arma o armadura famosa). Si tienes éxito, descubres todo lo que hay que saber sobre las cualidades del objeto y si está maldito o no."
            },
            {
                "tipo": "Inscribir runas de poder",
                "efecto": "Durante una fase de comunidad, puedes inscribir runas de poder en un objeto no mágico. Mientras una criatura tenga o lleve puesto el objeto, obtiene un bonificador +1 a las tiradas de salvación.",
                "alternativa": "Si el objeto es un escudo o un arma, puedes atribuirle una perdición en su lugar. Elige un tipo de criatura entre hombres malignos, orcos, arañas, troles, muertos vivientes o lobos. Si el objeto tiene una o más recompensas, sus efectos se duplican contra criaturas sujetas a la perdición."
            }
        ],
        "nivel_5": "Puedes inscribir runas de poder en dos objetos en lugar de uno.",
        "reglas_especiales": [
            "Las runas solo pueden inscribirse una vez en cada objeto.",
            "No puedes recuperar un espacio de arte usado de esta manera hasta la siguiente fase de comunidad, momento en el que puedes cancelar las runas inscritas con ese espacio y recuperarlo, si quieres."
        ],
        "tipos_perdicion": ["hombres malignos", "orcos", "arañas", "troles", "muertos vivientes", "lobos"]
    },
    {
        "nombre": "Arte de los Bosques",
        "descripcion_corta": "Estás familiarizado con las dificultades que surgen al atravesar tierras salvajes y con las formas de superarlas.",
        "descripcion": """Estás familiarizado con las dificultades que surgen al atravesar tierras salvajes y con las formas de superarlas.

Puedes hacer una prueba de Inteligencia (Naturaleza) en lugar de cualquier prueba de Sabiduría (Explorar) o Sabiduría (Cazar).

Además, puedes gastar 1 hora y un espacio de arte para realizar una prueba de Inteligencia (Naturaleza), Sabiduría (Explorar) o Sabiduría (Cazar) (a elegir). La CD está determinada por el tipo de terreno que la compañía está atravesando en este momento. La prueba tiene desventaja si es otoño o invierno.""",
        "requisitos": [],
        "opciones": [
            {
                "tipo": "Sigilo",
                "efecto": "Elige un número de criaturas igual al resultado de tu prueba menos la CD del terreno (mínimo 1), entre las que puedes incluirte. Durante 1 hora, cada una de dichas criaturas tiene un bonificador +5 a las pruebas de Destreza (Sigilo).",
                "nivel_5": "El bonificador aumenta a +10. Si obtienes un éxito mágico, las criaturas tampoco dejan huellas ni ningún otro rastro de su paso mientras dura el efecto."
            },
            {
                "tipo": "Percepción",
                "efecto": "Elige un número de criaturas igual al resultado de tu prueba menos la CD del terreno (mínimo 1), entre las que puedes incluirte. Durante 8 horas, cada una de dichas criaturas tiene un bonificador +5 a su puntuación pasiva de Sabiduría (Percepción).",
                "nivel_5": "El bonificador aumenta a +10. Si obtienes un éxito mágico, las criaturas también obtienen sentir vibraciones hasta un alcance de 60 pies mientras dura el efecto."
            },
            {
                "tipo": "Comida y agua",
                "efecto": "Consigues un número de libras de comida y galones de agua igual al resultado de tu prueba menos la CD del terreno (mínimo 1). La comida dura 24 horas.",
                "nivel_5": "La comida dura 48 horas. Si obtienes un éxito mágico, cada libra de comida forrajeada de esta forma también restaura 1 punto de golpe a la criatura que la come durante un descanso corto o largo."
            }
        ],
        "reglas_especiales": [
            "La prueba tiene desventaja si es otoño o invierno."
        ]
    }
]


async def update_artes():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    print("Updating Artes with complete data from PDF...")
    
    # Clear existing artes
    await db.artes.delete_many({})
    
    # Insert updated artes
    for arte in ARTES_COMPLETAS:
        arte_doc = {
            "_id": str(hash(arte["nombre"]) % 10**12),
            **arte,
            "created_at": now_utc(),
            "updated_at": now_utc()
        }
        await db.artes.insert_one(arte_doc)
        print(f"  - Updated: {arte['nombre']}")
    
    print(f"\nTotal artes updated: {len(ARTES_COMPLETAS)}")


if __name__ == "__main__":
    asyncio.run(update_artes())
