// Lumen Cards: every card of the library in one module (the file HACS installs).
import "./core/lumen-icon";
import "./cards/weather-background";
import "./cards/greeting";
import "./cards/title";
import "./cards/light";
import "./cards/chips";
import "./cards/reminder";
import "./cards/person";
import "./cards/alarm";
import "./cards/entity";
import "./cards/lock";
import "./cards/button";
import "./cards/sensor";
import "./cards/climate";
import "./cards/air-quality";

declare const __LUMEN_VERSION__: string;

console.info(`%c LUMEN-CARDS %c ${__LUMEN_VERSION__} `, "color:#fff;background:#1B1916;font-weight:700", "color:#1B1916;background:#F2F0EC");
