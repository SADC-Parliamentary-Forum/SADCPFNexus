import type { Dict } from "../keys.ts";
import * as procurement from "./procurement.ts";
import * as admin from "./admin.ts";
import * as travel from "./travel.ts";
import * as people from "./people.ts";
import * as settings from "./settings.ts";
import * as timesheets from "./timesheets.ts";
import * as pif from "./pif.ts";
import * as mande from "./mande.ts";
import * as finance from "./finance.ts";
import * as assets from "./assets.ts";

/** Per-module catalogs, split so each module's keys live beside its own list of screens. */
export const catalogGroups = { procurement, admin, travel, people, settings, timesheets, pif, mande, finance, assets };

const groups = Object.values(catalogGroups);

export const catalogEn: Dict = Object.assign({}, ...groups.map((g) => g.en));
export const catalogFr: Dict = Object.assign({}, ...groups.map((g) => g.fr));
export const catalogPt: Dict = Object.assign({}, ...groups.map((g) => g.pt));
