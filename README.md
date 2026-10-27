# DungeonMess

Roguelike incremental de mazmorras para el navegador. Bajas piso a piso por una cripta generada al azar, recoges armas del suelo, reúnes oro para gastarlo en los mercados que hay entre pisos, subes de nivel y, cuando caes, conservas las almas para gastarlas en un árbol de habilidades permanente que te deja llegar cada vez más hondo.

No necesita compilación ni dependencias: es HTML, CSS y JavaScript plano, listo para GitHub Pages.

## Novedades de la versión 0.3

- **Ataque manual**: se apunta con el ratón; el clic izquierdo ataca con la mano izquierda y el derecho con la derecha (mantener pulsado repite el ataque al ritmo del arma). Un arma a dos manos responde a cualquiera de los dos clics y una mano vacía da puñetazos.
- **Escudo activo**: mantener el clic de la mano del escudo te cubre y bloquea todo lo que llega por delante, a cambio de moverte más despacio.
- **Sin menú del navegador**: dentro del juego el clic derecho ya no abre el menú contextual ni el clic central activa el desplazamiento.
- **Móvil**: dos botones de ataque (Izq. y Der.) que apuntan solos al enemigo más cercano.
- **Ataque automático opcional**: en la pausa se puede volver al ataque automático de antes. El piloto automático y el simulador siguen atacando solos.
- **Paquete sorpresa** en el mercado: dos por mercado, cada uno más caro. Al abrirlo eliges uno de tres objetos de categorías distintas (arma épica o legendaria, reliquia, pergamino o compañero).

## Novedades de la versión 0.2

- **Oro**: los enemigos sueltan monedas (las élites y los jefes, más), cada piso puede tener cofres y cualquier arma del suelo se puede **fundir** en oro. El oro dura solo la partida: al caer se pierde.
- **Mercados entre pisos**: después de los pisos 2, 5, 7, 10, 12, 15… hay un piso seguro con un mercader y varias mesas:
  - 3 armas (siempre raras o mejores).
  - 2 **reliquias**: habilidades pasivas para toda la partida (12 distintas: Corona de brasas, Cáliz de sangre, Guanteletes gemelos, Cinturón del gigante, Ojo del cuervo…). Cada reliquia que tienes encarece la siguiente.
  - 1 **pergamino** con una mejora de nivel concreta.
  - 1 **compañero**: Lobo espectral, Fuego fatuo, Gólem de bronce u Hada sanadora. Son espíritus que no mueren; comprar otra vez el mismo sube su nivel (hasta 5).
  - **Pociones** para el cinturón y una **Bendición** que cura toda la vida.
  - El mercader **renueva las mesas** a cambio de oro (cada vez más caro).
  - Desde la 0.3, un **paquete sorpresa** (ver arriba).
- **Cinturón de pociones**: las pociones se guardan y se beben cuando quieras (tecla R o botón).
- **Nueva rama del árbol, Comercio**: Bolsa heredada (oro inicial), Regateo (descuento), Saqueador (más oro), Cinturón (más pociones), Lazos (compañeros más fuertes) y Manada (más compañeros a la vez).
- **Atajo** ahora empieza la partida en un mercado con oro para equiparte antes de bajar.
- El **piloto automático** también recoge oro, abre cofres, funde lo que no le sirve y compra en el mercado.
- La pausa muestra el inventario de la partida: oro, compañeros, reliquias y mejoras.

## Qué incluye

- **Mazmorras procedurales**: salas y pasillos distintos en cada piso, niebla de guerra y una antorcha que solo ilumina lo cercano.
- **Enemigos que escalan**: cada piso tienen un 25% más de vida y un 12% más de daño. Ocho tipos (ratas, esqueletos, arqueros, limos que se dividen, murciélagos, brutos, brujos y caballeros que resisten las flechas), más élites con borde dorado.
- **Jefes cada cinco pisos**: El Carcelero, La Reina Liche y el Gólem de huesos, en rotación y cada vez más fuertes. Cierran las escaleras hasta que caen.
- **16 armas y un escudo en el suelo**:
  - Una mano, cuerpo a cuerpo: daga, espada corta, hacha de mano, maza.
  - Dos manos, cuerpo a cuerpo: mandoble, hacha de guerra, lanza, martillo de guerra.
  - Una mano, a distancia: honda, cuchillos arrojadizos, varita, ballesta de mano.
  - Dos manos, a distancia: arco largo, arco recurvo, ballesta pesada, bastón arcano.
  - Escudo (una mano): bloquea golpes y da armadura.
- **Dos manos de verdad**: puedes llevar dos armas de una mano a la vez (cada una ataca a su ritmo, incluso mezclando cuerpo a cuerpo y distancia) o una de dos manos. Al recoger un arma eliges en qué mano va y ves cuánto cambia tu daño por segundo antes de decidir.
- **Rarezas** común, rara, épica y legendaria; las dos últimas traen efectos (vampírica, gélida, ígnea, veloz, afilada, pesada, certera…).
- **Subida de nivel** con tres mejoras a elegir durante la partida.
- **Árbol de habilidades** con 35 nodos en seis ramas: Acero, Puntería, Doble filo, Vigor, Fortuna y Comercio. Incluye *Atajo* (empezar más abajo) y *Piloto automático* (el héroe juega solo, el toque incremental).
- **Controles** de teclado y táctiles (joystick virtual), sonido sintetizado y guardado automático en el navegador.

## Controles

| Acción | Teclado | Móvil |
| --- | --- | --- |
| Moverse | WASD o flechas | Arrastrar en la mitad izquierda |
| Apuntar | Ratón | Automático (al enemigo más cercano) |
| Atacar con la mano izquierda / derecha | Clic izquierdo / clic derecho (mantener para repetir) | Botones «Izq.» y «Der.» |
| Cubrirse con el escudo | Mantener el clic de la mano del escudo | Mantener su botón |
| Rodar (invulnerable un instante) | Espacio | Botón «Rodar» |
| Equipar arma del suelo | Q (izquierda), E (derecha o dos manos) | Botones de la ficha |
| Fundir arma del suelo en oro | X | Botón «Fundir» |
| Comprar en el mercado / renovar mesas | E (Q para la mano izquierda en armas) | Botones de la ficha |
| Elegir objeto del paquete sorpresa | 1, 2, 3 o clic | Tocar la carta |
| Beber poción | R | Botón del cinturón |
| Bajar escaleras | F | Botón «Bajar al…» |
| Piloto automático | T | Botón «Auto» |
| Pausa (y ajuste de ataque automático) | Esc o P | Botón «Pausa» |

## Publicarlo en GitHub Pages

1. Crea un repositorio nuevo (por ejemplo `dungeonmess`) y sube el contenido de esta carpeta a la raíz, con `index.html` en primer nivel.
2. En el repositorio ve a **Settings → Pages**.
3. En **Build and deployment**, elige **Deploy from a branch**, la rama `main` y la carpeta `/ (root)`. Guarda.
4. En un minuto estará en `https://TU_USUARIO.github.io/dungeonmess/`.

También puedes jugar en local abriendo `index.html` directamente en el navegador.

## Estructura

```
index.html          Pantallas, HUD y modales
css/style.css       Estilos
js/data.js          Contenido y equilibrio: armas, enemigos, jefes, mejoras, reliquias, compañeros, mercado y árbol
js/dungeon.js       Generación de pisos y del mercado, visión y búsqueda de caminos
js/game.js          Motor (sin DOM): combate, IA, manos, oro, mercado, compañeros, progresión y piloto automático
js/render.js        Dibujo en canvas (todo vectorial, sin imágenes)
js/audio.js         Efectos de sonido con Web Audio
js/app.js           Interfaz, controles y bucle principal
tools/simulador.html  Simulador de equilibrio (opcional)
tools/sim.js
```

## Ajustar la dificultad

Casi todo se toca en `js/data.js`:

- `G.BAL.enemyHp` y `G.BAL.enemyDmg`: cuánto crecen los enemigos por piso (1,25 y 1,12).
- `G.BAL.weaponGrowth`: cuánto crecen las armas por piso (1,10).
- `G.BAL.soulPerXp` y `G.BAL.soulFloorGrowth`: cuántas almas se ganan.
- `G.BAL.econGrowth`, `G.BAL.goldDrop` y `G.BAL.chestChance`: cuánto oro se gana; `G.isShopAfter` decide tras qué pisos hay mercado.
- `G.SHOP`, `price` en `G.RELICS` y `G.COMPANIONS`: precios del mercado (se multiplican por la economía del piso).
- `cost: [base, crecimiento]` en cada nodo del árbol.

Después abre `tools/simulador.html` (con el juego servido o en local) y lanza una campaña: el piloto automático juega partidas seguidas, compra en el mercado, mejora el árbol y muestra el piso alcanzado, el oro y lo que compró en cada una. Con los valores actuales, la primera partida suele caer ante el primer o el segundo jefe (pisos 5 a 10), hacia la décima se supera el piso 30 y a partir de ahí los enemigos crecen más rápido que el héroe (en torno al piso 35).

## Guardado

La progresión se guarda en `localStorage` con la clave `dungeonmess.save.v1` (si tenías una partida guardada con el nombre anterior, `descenso.save.v1`, se migra sola la primera vez). Para empezar de cero, bórrala desde las herramientas del navegador.
