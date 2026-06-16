"""
Datos estáticos para la creación de PNJ comerciantes (Tienda / Compra-Venta).

Incluye:
  - PROFESIONES: lista cerrada de profesiones de comerciante.
  - RASGOS_NEGATIVOS / RASGOS_POSITIVOS: catálogo de rasgos (uno por PNJ).
  - MODOS_HABLA: estilos de habla (50% normal / 50% uno de estos).
  - Lógica de COHERENCIA: cada rasgo lleva "tags"; cada raza/profesión prohíbe
    ciertos tags para evitar combinaciones que rompan la ambientación.

Helpers:
  - rasgos_validos(raza, profesion) -> {"positivos": [...], "negativos": [...]}
  - elegir_rasgo_aleatorio(raza, profesion) -> {"nombre", "descripcion", "tipo"}
  - elegir_modo_hablar() -> {"nombre", "descripcion"}  (o None = normal)
"""
import random

# ---------------------------------------------------------------------------
# PROFESIONES (lista cerrada)
# ---------------------------------------------------------------------------
PROFESIONES = [
    "Campesino", "Leñador", "Peón de construcción", "Mozo de cuadra", "Cazador",
    "Herrero aprendiz", "Barquero / Remero", "Herrero", "Carpintero", "Albañil",
    "Mercader", "Posadero", "Explorador / Rastreador", "Músico / Juglar",
    "Sanador / Herbalista", "Arquero de élite", "Maestro de escuela",
    "Capitán de la guardia", "Caballero de Gondor", "Señor de una aldea",
    "Príncipe o noble", "Enano Herrero", "Elfo Artesano", "Mago Errante",
    "Hobbit Posadero", "Delincuente", "Atracador", "Salteador de caminos",
]

# Profesiones de perfil criminal (para excluir rasgos demasiado nobles).
PROFESIONES_CRIMINALES = {"Delincuente", "Atracador", "Salteador de caminos"}


# ---------------------------------------------------------------------------
# RASGOS NEGATIVOS  (nombre, descripcion, tags)
# tags posibles: suciedad, mala_artesania, caos, antimagia, magia_falsa,
#                violencia, criminal
# ---------------------------------------------------------------------------
RASGOS_NEGATIVOS = [
    {"nombre": "Redondeo usurero", "descripcion": "Siempre \"se equivoca\" unos pocos cobres a su favor al dar el cambio y se ofende muchísimo si lo corrigen.", "tags": []},
    {"nombre": "Obsesión por el peso", "descripcion": "Pesa las monedas de oro en una balanza minúscula frente a los jugadores, rechazando las que están desgastadas o limadas.", "tags": []},
    {"nombre": "El recargo por \"peligrosidad\"", "descripcion": "Si ve a los personajes armados o heridos, les sube los precios un 20% alegando que \"atraen problemas a la tienda\".", "tags": []},
    {"nombre": "Alquiler en vez de venta", "descripcion": "Intenta convencer a los aventureros de alquilar el equipo caro con fianzas abusivas, esperando que mueran para quedarse con el dinero.", "tags": []},
    {"nombre": "Avaricia por las gemas", "descripcion": "Si los jugadores pagan con piedras preciosas, les resta valor sistemáticamente alegando \"impurezas imperceptibles\".", "tags": []},
    {"nombre": "No fía ni a su madre", "descripcion": "Tiene un cartel enorme que ridiculiza a los clientes que piden crédito; jamás hace excepciones, ni en mitad de una crisis.", "tags": []},
    {"nombre": "La \"tarifa de almacenamiento\"", "descripcion": "Si los jugadores le piden que les guarde algo o les reserve un objeto, les cobra por cada hora que pasa.", "tags": []},
    {"nombre": "Especulador de crisis", "descripcion": "Si se entera de que hay monstruos cerca, esconde el equipo militar y las pociones para venderlos al triple de precio al día siguiente.", "tags": []},
    {"nombre": "Churrero del metal", "descripcion": "Limpia las armas viejas con grasa y hollín para que parezcan \"pavonadas de calidad\" cuando en realidad están picadas de óxido.", "tags": ["mala_artesania"]},
    {"nombre": "Barniz ocultador", "descripcion": "Pinta los escudos y armaduras de madera agrietada para ocultar los daños estructurales.", "tags": ["mala_artesania"]},
    {"nombre": "Racionamiento rancio", "descripcion": "Sus raciones de viaje están al límite de la fecha de caducidad; huelen ligeramente a humedad, pero jura que es \"esencia de hierbas\".", "tags": ["suciedad", "mala_artesania"]},
    {"nombre": "Cuerdas pasadas", "descripcion": "Vende cuerdas que han estado almacenadas en lugares húmedos; parecen fuertes, pero tienen penalización si soportan mucho peso.", "tags": ["mala_artesania"]},
    {"nombre": "Flechas torcidas", "descripcion": "Vende flechas baratas hechas con madera mal secada que tiende a desviarse en tiros largos.", "tags": ["mala_artesania"]},
    {"nombre": "Aceite adulterado", "descripcion": "Rebaja el aceite de las linternas con agua o grasas animales baratas; dura la mitad de tiempo encendido y echa un humo negro apestoso.", "tags": ["mala_artesania"]},
    {"nombre": "Falso experto en magia", "descripcion": "Vende cualquier baratija brillante o antigua como \"una reliquia de la Segunda Edad\", cobrando un extra por una historia inventada.", "tags": ["magia_falsa", "mala_artesania"]},
    {"nombre": "Mulas dudosas", "descripcion": "Si vende animales de carga, siempre son viejos, tercos o tienen alguna cojera oculta que solo aparece tras un día de marcha.", "tags": ["mala_artesania"]},
    {"nombre": "Pesimista profesional", "descripcion": "Asegura que los personajes van a morir en su próxima misión y les insiste en que compren mortajas o paguen su entierro por adelantado.", "tags": []},
    {"nombre": "Llorón constante", "descripcion": "Se queja sin parar de los impuestos locales, del clima, de la escasez y de lo duro que es su negocio, buscando dar lástima.", "tags": []},
    {"nombre": "Condescendencia elitista", "descripcion": "Trata a los aventureros como vagabundos peligrosos sin clase, limpiándose las manos con un paño tras tocar su dinero.", "tags": []},
    {"nombre": "Hablador compulsivo", "descripcion": "Te envuelve en una conversación eterna sobre chismes locales para distraerte mientras te cobra de más o te mete un objeto defectuoso.", "tags": []},
    {"nombre": "Adulador empalagoso", "descripcion": "Alaba exageradamente la belleza o fuerza de los personajes con cumplidos falsos que resultan incómodos.", "tags": []},
    {"nombre": "Mal perdedor en el regateo", "descripcion": "Si los jugadores logran bajarle el precio, les tira el objeto de mala gana y les prohíbe volver a su tienda esa semana.", "tags": []},
    {"nombre": "El \"Sabelotodo\" de pacotilla", "descripcion": "Da consejos tácticos y de supervivencia absurdos y peligrosos a los personajes, insistiendo en que él \"sabe más de aventuras que ellos\".", "tags": []},
    {"nombre": "Racismo cultural sutil", "descripcion": "Muestra un claro favoritismo (o desprecio) por ciertas razas; por ejemplo, le cobra el doble a los enanos o desconfía de los elfos.", "tags": []},
    {"nombre": "Mirada de urraca", "descripcion": "No quita los ojos de las manos de los jugadores; está convencido de que todos van a robarle y lo dice en voz alta.", "tags": []},
    {"nombre": "El mostrador trampa", "descripcion": "Mantiene una reja o un mostrador absurdamente ancho entre él y los clientes, y atiende con una ballesta cargada oculta debajo.", "tags": ["violencia"]},
    {"nombre": "Acompañante intimidatorio", "descripcion": "Tiene a un matón enorme y silencioso detrás de él que cruje los nudillos cada vez que los jugadores piden un descuento.", "tags": ["violencia"]},
    {"nombre": "Obsesión por las marcas", "descripcion": "Revisa cada moneda para asegurarse de que no sea falsa, mordiéndola o golpeándola contra el mostrador.", "tags": []},
    {"nombre": "Registro al salir", "descripcion": "Exige revisar las mochilas de los personajes antes de que abandonen el establecimiento \"por protocolo de seguridad\".", "tags": []},
    {"nombre": "No toca el dinero directamente", "descripcion": "Hace que los clientes dejen las monedas en un cuenco con vinagre para \"limpiar la podredumbre del camino\" antes de cogerlas.", "tags": []},
    {"nombre": "Tos tísica", "descripcion": "Tose continuamente sobre el equipo, las raciones y las manos de los jugadores mientras habla del precio.", "tags": ["suciedad"]},
    {"nombre": "Higiene deplorable", "descripcion": "Huele tan mal (a cuero rancio, sebo o sudor viejo) que estar más de cinco minutos negociando en su tienda cerrada requiere un chequeo de constitución.", "tags": ["suciedad"]},
    {"nombre": "Manos de grasa", "descripcion": "Siempre está comiendo un guiso grasiento o tocando herramientas sucias y deja huellas pringosas en todo el equipo nuevo que muestra.", "tags": ["suciedad"]},
    {"nombre": "Tic nervioso molesto", "descripcion": "Golpea rítmicamente el mostrador con una moneda de oro vieja, un sonido desquiciante que corta el ritmo de la negociación.", "tags": []},
    {"nombre": "Ambiente asfixiante", "descripcion": "Quema un incienso barato y denso en la tienda para ocultar otros olores, haciendo que los clientes salgan con dolor de cabeza.", "tags": ["suciedad"]},
    {"nombre": "Comprador de sangre", "descripcion": "Acepta comprar equipo usado que claramente tiene manchas de sangre fresca y agujeros de espada, sin preguntas pero pagando una miseria.", "tags": ["criminal"]},
    {"nombre": "Informante de bandidos", "descripcion": "Vende información sobre lo que compran los aventureros (y hacia dónde van) a los ladrones de los caminos locales a cambio de un porcentaje.", "tags": ["criminal"]},
    {"nombre": "Marcas de propiedad", "descripcion": "El equipo que vende tiene marcas borradas sospechosamente; podría ser propiedad robada de la guardia de la ciudad o de otra caravana.", "tags": ["criminal"]},
    {"nombre": "Contrabandista asustadizo", "descripcion": "Interrumpe la venta y echa a los jugadores a la calle si ve pasar a la guardia local cerca de su puerta.", "tags": ["criminal"]},
    {"nombre": "El cambiazo nocturno", "descripcion": "Si los jugadores dejan pagado un equipo para recogerlo al día siguiente, les entrega uno de calidad notablemente inferior alegando que \"es el mismo\".", "tags": ["mala_artesania"]},
    {"nombre": "Horario lunático", "descripcion": "Abre la tienda a horas intempestivas y se niega a atender si estás un minuto fuera de horario.", "tags": []},
    {"nombre": "Venta en lotes obligatoria", "descripcion": "No te vende una cuerda si no le compras también un lote de estacas de hierro inservibles que quiere quitarse de encima.", "tags": []},
    {"nombre": "Trueque absurdo", "descripcion": "A veces se niega a aceptar dinero común y exige que le paguen con cosas extrañas (\"esta espada vale tres gallinas gordas y un sombrero verde\").", "tags": []},
    {"nombre": "El catálogo fantasma", "descripcion": "Insiste en que tiene el mejor equipo del mundo en la trastienda, pero pide una \"tarifa de visualización\" no reembolsable solo para ir a buscarlo.", "tags": []},
    {"nombre": "Supersticioso del clima", "descripcion": "Si llueve o truena, considera que son malos augurios para el comercio y sube los precios porque \"la mala suerte cuesta dinero\".", "tags": []},
    {"nombre": "Fascinación por el equipo orco", "descripcion": "Le encanta comprar armas y escudos malditos o de factura orca/maligna porque dice que \"el hierro es hierro\", sin importarle la moralidad.", "tags": ["criminal"]},
    {"nombre": "Sordo selectivo", "descripcion": "Se hace el sordo cuando los jugadores intentan regatear, pero oye perfectamente el tintineo de una sola moneda cayendo al suelo.", "tags": []},
    {"nombre": "Desorganización caótica", "descripcion": "Su tienda es un basurero. Tarda media hora en encontrar una simple mochila y a veces vende cosas sin saber el precio real.", "tags": ["caos"]},
    {"nombre": "Aversión a la magia", "descripcion": "Se niega por completo a tocar o tasar objetos mágicos; cree que están malditos y ahuyenta a los magos con un amuleto de sal.", "tags": ["antimagia"]},
    {"nombre": "El precio del renombre", "descripcion": "Si los personajes son famosos o caen bien en el pueblo, les cobra un extra por \"el estatus\" de comprar en su prestigioso establecimiento.", "tags": []},
]


# ---------------------------------------------------------------------------
# RASGOS POSITIVOS  (nombre, descripcion, tags)
# tag "santo" = demasiado noble para perfiles criminales.
# ---------------------------------------------------------------------------
RASGOS_POSITIVOS = [
    {"nombre": "Tasador honesto", "descripcion": "Te dirá el valor real y justo de cualquier objeto que le traigas, sin intentar engañarte porque te vea apurado.", "tags": ["santo"]},
    {"nombre": "El descuento del héroe", "descripcion": "Si los personajes están realizando una misión que ayuda a la comunidad local, les rebaja los precios de forma voluntaria.", "tags": ["santo"]},
    {"nombre": "Tratamiento antifricción", "descripcion": "Aplica aceites especiales a las uniones de las armaduras de cuero o metal para que no hagan ruido al moverse con sigilo.", "tags": []},
    {"nombre": "Raciones generosas", "descripcion": "Sus raciones de viaje son de excelente calidad, envasadas con mimo, y siempre añade un extra de salazón o frutos secos de regalo.", "tags": []},
    {"nombre": "Contactos lejanos", "descripcion": "Tiene la capacidad de encargar equipo raro o exótico a caravanas que vienen de regiones muy distantes si se le da tiempo.", "tags": []},
    {"nombre": "Remiendos gratuitos", "descripcion": "Si le compras una pieza de armadura o mochila, te coserá o reparará las correas desgastadas del resto de tu equipo sin cobrarte nada.", "tags": []},
    {"nombre": "Filántropo discreto", "descripcion": "Si ve a un personaje realmente necesitado, le \"regala\" un objeto básico simulando que es una oferta por liquidación para no herir su orgullo.", "tags": ["santo"]},
    {"nombre": "Informante de confianza", "descripcion": "Conoce muy bien los rumores locales sobre los caminos y te advertirá gratis si sabe que una ruta comercial se ha vuelto peligrosa.", "tags": []},
    {"nombre": "Cuerdas reforzadas", "descripcion": "Vende cuerdas de cáñamo o lino trenzadas a mano por él mismo que son notablemente más resistentes y ligeras que las comunes.", "tags": []},
    {"nombre": "Garantía de cambio", "descripcion": "Si un objeto se rompe durante su primer uso legítimo por un defecto de fabricación, te lo cambia por uno nuevo sin preguntas.", "tags": []},
    {"nombre": "Ojo para la artesanía", "descripcion": "Detecta al instante el origen de un arma (enana, élfica o de los hombres del norte) y elogia el buen trabajo ante los jugadores.", "tags": []},
    {"nombre": "El rincón de las ofertas", "descripcion": "Tiene un arcón con equipo usado pero perfectamente funcional que vende a mitad de precio para quitarse excedente de inventario.", "tags": []},
    {"nombre": "Veterano consejero", "descripcion": "Fue soldado o explorador en su juventud, así que da consejos muy útiles y realistas sobre qué equipo es imprescindible para cada terreno.", "tags": []},
    {"nombre": "Fiador de palabra", "descripcion": "Si los personajes tienen una excelente reputación, está dispuesto a fiarles equipo vital con la promesa de que paguen al regresar.", "tags": []},
    {"nombre": "Armero meticuloso", "descripcion": "Entrega las armas perfectamente afiladas, equilibradas y con las empuñaduras encordadas de nuevo para que no resbalen con el sudor.", "tags": []},
    {"nombre": "Discreción absoluta", "descripcion": "Jamás revelará a nadie (ni a la guardia, ni a extraños) qué equipo han comprado los personajes o qué dirección pretendían tomar.", "tags": []},
    {"nombre": "Cuidado de animales", "descripcion": "Si vende ponis o mulas, los animales están sanos, bien alimentados, herrados recientemente y acostumbrados a cargas pesadas.", "tags": []},
    {"nombre": "Prueba antes de comprar", "descripcion": "Permite a los personajes probar el equilibrio de una espada o ponerse una cota de malla en el patio trasero antes de decidir.", "tags": []},
    {"nombre": "Organización ejemplar", "descripcion": "Su tienda está pulcra y perfectamente ordenada; sabe exactamente dónde está cada objeto y la transacción se hace en un par de minutos.", "tags": []},
    {"nombre": "Trato igualitario", "descripcion": "Atiende con el mismo respeto, paciencia y cortesía a un humilde mediano de la Comarca que a un noble caballero de la gran ciudad.", "tags": ["santo"]},
    {"nombre": "Embalaje impermeable", "descripcion": "Envuelve mapas, pergaminos y raciones en telas enceradas para que no se echen a perder aunque caiga una tormenta o crucen un río.", "tags": []},
    {"nombre": "Flechas equilibradas", "descripcion": "Revisa el astil y las plumas de cada flecha que vende para asegurarse de que el vuelo sea completamente recto y predecible.", "tags": []},
    {"nombre": "El trueque justo", "descripcion": "Acepta con agrado el intercambio de bienes en lugar de monedas si el objeto que le ofrecen le resulta útil para su negocio.", "tags": []},
    {"nombre": "Amuleto de buena suerte", "descripcion": "Suele regalar una pequeña talla de madera, una cinta de color o una bendición tradicional del camino con cada compra importante.", "tags": []},
    {"nombre": "Luz de larga duración", "descripcion": "El aceite para linternas que vende es destilado puro, no echa humo negro y dura notablemente más que el de sus competidores.", "tags": []},
    {"nombre": "Paciencia infinita", "descripcion": "Escucha con atención y amabilidad los largos debates de los jugadores sobre qué comprar, sin meterles prisa ni mostrar molestia.", "tags": []},
    {"nombre": "Conexión con artesanos", "descripcion": "Si necesitas una modificación muy específica en un escudo o armadura, te pondrá en contacto directo con el mejor herrero de la región.", "tags": []},
    {"nombre": "Antídotos caseros", "descripcion": "Sabe preparar ungüentos básicos contra picaduras o hierbas para infusiones que alivian la fatiga del viaje, y los vende baratos.", "tags": []},
    {"nombre": "Optimista contagioso", "descripcion": "Siempre despide a los aventureros con una sonrisa sincera y palabras de ánimo que suben la moral del grupo antes de partir.", "tags": []},
    {"nombre": "No especula", "descripcion": "Aunque haya escasez o peligro inminente en la zona, mantiene los precios estándar de sus productos sin aprovecharse de la necesidad ajena.", "tags": ["santo"]},
    {"nombre": "Odres curados", "descripcion": "Los odres de agua que vende están perfectamente curados y tratados para que el líquido no adquiera sabor a pez o cuero viejo.", "tags": []},
    {"nombre": "Historiador aficionado", "descripcion": "Le fascina el pasado; si le traes un objeto antiguo, pasará horas investigando su origen en sus crónicas familiares por el placer de saberlo.", "tags": []},
    {"nombre": "Mochilas ergonómicas", "descripcion": "Sus mochilas y macutos tienen almohadillas de fieltro o lana en las correas para que no lastimen los hombros tras días de marcha.", "tags": []},
    {"nombre": "Calzado a medida", "descripcion": "Vende botas de viaje reforzadas y te ayuda a ajustarlas con plantillas de fieltro para evitar ampollas en los primeros kilómetros.", "tags": []},
    {"nombre": "Protección contra el frío", "descripcion": "Sus mantas y capas están hechas de lana densa y tupida que corta el viento y aísla del frío de las montañas de forma magnífica.", "tags": []},
    {"nombre": "El secreto de la trastienda", "descripcion": "Guarda sus mejores piezas (acero superior o manufactura experta) solo para clientes habituales o aquellos que demuestran ser honorables.", "tags": []},
    {"nombre": "Defensor de sus clientes", "descripcion": "Si la guardia local o algún matón intenta molestar a los personajes dentro de su establecimiento, saldrá en su defensa sin dudarlo.", "tags": []},
    {"nombre": "Herramientas templadas", "descripcion": "Los picos, palas y herramientas de hierro que vende han pasado por un buen templado; no se doblarán ni mellarán al primer golpe.", "tags": []},
    {"nombre": "Pintura protectora", "descripcion": "Vende escudos de madera recubiertos con una capa de lona encolada y pintura que evita que la madera se astille fácilmente.", "tags": []},
    {"nombre": "Tallas exactas", "descripcion": "Dispone de un gran surtido de tamaños; si un personaje es muy alto, robusto o pequeño, encontrará ropa de viaje y armaduras a su medida.", "tags": []},
    {"nombre": "Limpieza de reliquias", "descripcion": "Si le vendes un arma antigua de una ruina, la restaurará con respeto y tratará de devolverle su antiguo esplendor en lugar de fundirla.", "tags": []},
    {"nombre": "Anticipo por recolección", "descripcion": "Si sabe que vais a una zona concreta, os paga por adelantado una pequeña suma si prometéis traerle plantas raras o materiales escasos.", "tags": []},
    {"nombre": "Velas antigoteo", "descripcion": "Vende velas de cera de abeja pura que iluminan más, no huelen mal y apenas gotean, ideales para espacios cerrados o subterráneos.", "tags": []},
    {"nombre": "Kit de mantenimiento incluido", "descripcion": "Al comprar un arma cara, te regala una pequeña piedra de afilar y un trapo engrasado para que puedas cuidarla en el camino.", "tags": []},
    {"nombre": "Respetuoso con las costumbres", "descripcion": "Conoce y respeta los tabúes y tradiciones de las culturas de la Tierra Media, adaptando su comportamiento para que nadie se ofenda.", "tags": []},
    {"nombre": "El precio de catálogo", "descripcion": "Tiene una pizarra con los precios escritos de forma clara y visible; no intenta cobrar de más según las ropas o el aspecto del cliente.", "tags": []},
    {"nombre": "Compromiso comunitario", "descripcion": "Usa parte de sus ganancias para apoyar a viudas, huérfanos o la reconstrucción de las defensas del pueblo, lo que le gana el afecto de todos.", "tags": ["santo"]},
    {"nombre": "Cerraduras engrasadas", "descripcion": "Los cofres y cajas que vende incluyen cerraduras de hierro bien ajustadas y ejes engrasados que abren con total suavidad.", "tags": []},
    {"nombre": "Compartimentos ocultos", "descripcion": "A petición del cliente, puede coser bolsillos secretos en las capas o hacer fondos falsos en las mochilas para esconder mapas o monedas.", "tags": []},
    {"nombre": "Memoria de oro", "descripcion": "Recuerda los nombres de los personajes, sus gustos y el equipo que compraron en su última visita, haciéndoles sentir bienvenidos.", "tags": []},
]


# ---------------------------------------------------------------------------
# MODOS DE HABLA  (50% normal / 50% uno de estos)
# ---------------------------------------------------------------------------
MODOS_HABLA = [
    {"nombre": "El Seseo", "descripcion": "Pronuncia todas las \"c\" (ante e, i) y las \"z\" como \"s\"."},
    {"nombre": "Tartamudeo por ansiedad", "descripcion": "Bloqueo o repetición de la primera sílaba."},
    {"nombre": "Habla entre dientes (Mascullar)", "descripcion": "Palabras atropelladas, quejas para sí mismo en voz baja."},
    {"nombre": "Voz susurrante o conspiratoria", "descripcion": "Tono bajo y confidencial."},
    {"nombre": "Uso de terceras personas", "descripcion": "Se refiere a sí mismo por su nombre o cargo."},
    {"nombre": "Respiración sibilante", "descripcion": "Emite un leve silbido al respirar y hace pausas constantes para tomar aire."},
    {"nombre": "El \"Muletilla\" temático", "descripcion": "Usa una expresión repetitiva al final de cada frase adaptada a su negocio (ej. \"¿sabes cómo te digo?\")."},
    {"nombre": "Habla acelerada", "descripcion": "Velocidad endiablada sin dejar hablar al jugador."},
    {"nombre": "Pausas dramáticas", "descripcion": "Frases extremadamente cortas con pausas de segundos entre ellas."},
    {"nombre": "Acento cantarín", "descripcion": "Sube y baja el tono de voz de forma exagerada al final de las frases."},
    {"nombre": "Voz de falsete", "descripcion": "Voz inusualmente aguda o con gallos cómicos al emocionarse."},
    {"nombre": "Carraspeo crónico", "descripcion": "Se aclara la garganta ruidosamente antes de dar cifras o datos importantes."},
    {"nombre": "Voz cavernosa y profunda", "descripcion": "Tono barítono retumbante."},
    {"nombre": "Terminar en pregunta", "descripcion": "Busca siempre la aprobación del cliente (\"es un buen trato, ¿a que sí?\")."},
    {"nombre": "Metáforas de su oficio", "descripcion": "Traduce todo su vocabulario a su antigua profesión (marinero, soldado, etc.)."},
    {"nombre": "Ceceo", "descripcion": "Pronuncia las \"s\" como \"c\" o \"z\"."},
    {"nombre": "Habla jadeante", "descripcion": "Habla como si estuviera exhausto, soltando palabras entre soplidos."},
    {"nombre": "El adulador de títulos", "descripcion": "Inventa títulos pomposos para los jugadores en un tono sumiso."},
    {"nombre": "Voz monótona", "descripcion": "Tono robótico, plano y sin emociones."},
    {"nombre": "Repetición de la última palabra", "descripcion": "Repite la última palabra de sus propias frases (\"Buen acero, sí señor, buen acero...\")."},
]


# ---------------------------------------------------------------------------
# COHERENCIA — tags prohibidos por raza y por profesión
# ---------------------------------------------------------------------------
EXCLUSION_TAGS_RAZA = {
    "Elfos": ["suciedad", "mala_artesania", "caos", "criminal"],
    "Hobbits": ["violencia", "criminal"],
}

EXCLUSION_TAGS_PROFESION = {
    "Mago Errante": ["antimagia", "magia_falsa"],
    "Elfo Artesano": ["suciedad", "mala_artesania", "caos"],
    "Enano Herrero": ["mala_artesania"],
    "Sanador / Herbalista": ["suciedad"],
    "Posadero": ["suciedad"],
    "Hobbit Posadero": ["suciedad", "violencia"],
    "Maestro de escuela": ["suciedad", "caos"],
    "Capitán de la guardia": ["criminal"],
    "Caballero de Gondor": ["criminal", "mala_artesania"],
    "Señor de una aldea": ["criminal"],
    "Príncipe o noble": ["criminal", "suciedad", "mala_artesania"],
}


def _forbidden_tags(raza: str, profesion: str) -> set:
    tags = set()
    tags.update(EXCLUSION_TAGS_RAZA.get((raza or "").strip(), []))
    tags.update(EXCLUSION_TAGS_PROFESION.get((profesion or "").strip(), []))
    # Profesiones criminales: nada de rasgos demasiado nobles ("santo").
    if (profesion or "").strip() in PROFESIONES_CRIMINALES:
        tags.add("santo")
    return tags


def rasgos_validos(raza: str = "", profesion: str = "") -> dict:
    """Devuelve los rasgos positivos y negativos compatibles con la raza/profesión."""
    forbidden = _forbidden_tags(raza, profesion)

    def _ok(r):
        return not (set(r.get("tags", [])) & forbidden)

    return {
        "positivos": [r for r in RASGOS_POSITIVOS if _ok(r)],
        "negativos": [r for r in RASGOS_NEGATIVOS if _ok(r)],
    }


def elegir_rasgo_aleatorio(raza: str = "", profesion: str = "") -> dict:
    """Elige un rasgo válido al azar (50% positivo / 50% negativo)."""
    validos = rasgos_validos(raza, profesion)
    tipo = random.choice(["positivo", "negativo"])
    pool = validos["positivos"] if tipo == "positivo" else validos["negativos"]
    if not pool:  # por si la combinación deja un pool vacío
        pool = validos["negativos"] or validos["positivos"]
        tipo = "positivo" if pool is validos["positivos"] else "negativo"
    elegido = random.choice(pool)
    return {"nombre": elegido["nombre"], "descripcion": elegido["descripcion"], "tipo": tipo}


def elegir_modo_hablar() -> dict:
    """50% normal (None) / 50% un estilo aleatorio."""
    if random.random() < 0.5:
        return {"nombre": "Normal", "descripcion": "Habla de forma normal, sin rasgos distintivos."}
    return dict(random.choice(MODOS_HABLA))


def descripcion_rasgo(nombre: str):
    """Devuelve (descripcion, tipo) de un rasgo por su nombre, o (None, None)."""
    for r in RASGOS_POSITIVOS:
        if r["nombre"] == nombre:
            return r["descripcion"], "positivo"
    for r in RASGOS_NEGATIVOS:
        if r["nombre"] == nombre:
            return r["descripcion"], "negativo"
    return None, None
