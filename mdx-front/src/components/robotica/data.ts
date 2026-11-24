export type Match = {
  id: string;
  label: string;
  home: string;
  away: string;
  editable?: boolean;
};

export type Group = {
  id: string;
  name: string;
  teams: string[];
  matches: Match[];
};

export type Round = {
  id: string;
  name: string;
  matches: Match[];
};

export type BracketModality = {
  id: string;
  name: string;
  blurb: string;
  kind: "bracket";
  groups: Group[];
  rounds: Round[];
};

export type RaceEntry = {
  id: string;
  order: number;
  name: string;
};

export type RaceModality = {
  id: string;
  name: string;
  blurb: string;
  kind: "race";
  teams: RaceEntry[];
};

export type Modality = BracketModality | RaceModality;

function disputa(prefix: string, n: number, home: string, away: string): Match {
  return { id: `${prefix}-${n}`, label: `Disputa ${n}`, home, away };
}

function vagas(prefix: string, round: string, label: string, count: number): Match[] {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    return {
      id: `${prefix}-${round}-${n}`,
      label: count === 1 ? label : `Disputa ${n}`,
      home: "",
      away: "",
      editable: true,
    };
  });
}

function eliminatorias(prefix: string): Round[] {
  return [
    { id: `${prefix}-qf`, name: "Quartas de final", matches: vagas(prefix, "qf", "Disputa", 4) },
    { id: `${prefix}-sf`, name: "Semifinais", matches: vagas(prefix, "sf", "Disputa", 2) },
    { id: `${prefix}-final`, name: "Grande final", matches: vagas(prefix, "final", "Final", 1) },
    { id: `${prefix}-terceiro`, name: "Terceiro lugar", matches: vagas(prefix, "terceiro", "Terceiro lugar", 1) },
  ];
}

const cacaGroups: Group[] = [
  {
    id: "caca-g1",
    name: "Grupo 1",
    teams: ["C7 Volt", "Eagles One", "TechMInds", "TEAM DEAFT POWER"],
    matches: [
      disputa("caca-g1", 1, "C7 Volt", "Eagles One"),
      disputa("caca-g1", 2, "TechMInds", "TEAM DEAFT POWER"),
      disputa("caca-g1", 3, "C7 Volt", "TechMInds"),
      disputa("caca-g1", 4, "Eagles One", "TEAM DEAFT POWER"),
      disputa("caca-g1", 5, "C7 Volt", "TEAM DEAFT POWER"),
      disputa("caca-g1", 6, "Eagles One", "TechMInds"),
    ],
  },
  {
    id: "caca-g2",
    name: "Grupo 2",
    teams: ["TECH 5", "NAN MERMÃ", "Grupo LPD", "SINEY PRO"],
    matches: [
      disputa("caca-g2", 1, "TECH 5", "NAN MERMÃ"),
      disputa("caca-g2", 2, "Grupo LPD", "SINEY PRO"),
      disputa("caca-g2", 3, "TECH 5", "Grupo LPD"),
      disputa("caca-g2", 4, "NAN MERMÃ", "SINEY PRO"),
      disputa("caca-g2", 5, "TECH 5", "SINEY PRO"),
      disputa("caca-g2", 6, "NAN MERMÃ", "Grupo LPD"),
    ],
  },
  {
    id: "caca-g3",
    name: "Grupo 3",
    teams: ["Meninas Super Poderosas SD", "Tira Tec", "Tech Dragons - EMPA", "THE GIRLS"],
    matches: [
      disputa("caca-g3", 1, "Meninas Super Poderosas SD", "Tira Tec"),
      disputa("caca-g3", 2, "Tech Dragons - EMPA", "THE GIRLS"),
      disputa("caca-g3", 3, "Meninas Super Poderosas SD", "Tech Dragons - EMPA"),
      disputa("caca-g3", 4, "Tira Tec", "THE GIRLS"),
      disputa("caca-g3", 5, "Meninas Super Poderosas SD", "THE GIRLS"),
      disputa("caca-g3", 6, "Tira Tec", "Tech Dragons - EMPA"),
    ],
  },
  {
    id: "caca-g4",
    name: "Grupo 4",
    teams: ["TW Alfa", "MENINAS DE AÇO", "Meninas superpoderosas", "Tancredo Neves"],
    matches: [
      disputa("caca-g4", 1, "TW Alfa", "MENINAS DE AÇO"),
      disputa("caca-g4", 2, "Meninas superpoderosas", "Tancredo Neves"),
      disputa("caca-g4", 3, "TW Alfa", "Meninas superpoderosas"),
      disputa("caca-g4", 4, "MENINAS DE AÇO", "Tancredo Neves"),
      disputa("caca-g4", 5, "TW Alfa", "Tancredo Neves"),
      disputa("caca-g4", 6, "MENINAS DE AÇO", "Meninas superpoderosas"),
    ],
  },
];

const sumoGroups: Group[] = [
  {
    id: "sumo-g1",
    name: "Grupo 1",
    teams: ["DAMAS DO FUTURO", "ÔMEGA", "THE GIRLS", "UMIBOTS", "Tancredo Neves", "Tech Dragons - EMPA"],
    matches: [
      disputa("sumo-g1", 1, "DAMAS DO FUTURO", "Tech Dragons - EMPA"),
      disputa("sumo-g1", 2, "ÔMEGA", "Tancredo Neves"),
      disputa("sumo-g1", 3, "THE GIRLS", "UMIBOTS"),
      disputa("sumo-g1", 4, "DAMAS DO FUTURO", "Tancredo Neves"),
      disputa("sumo-g1", 5, "Tech Dragons - EMPA", "UMIBOTS"),
      disputa("sumo-g1", 6, "ÔMEGA", "THE GIRLS"),
      disputa("sumo-g1", 7, "DAMAS DO FUTURO", "UMIBOTS"),
      disputa("sumo-g1", 8, "Tancredo Neves", "THE GIRLS"),
      disputa("sumo-g1", 9, "Tech Dragons - EMPA", "ÔMEGA"),
      disputa("sumo-g1", 10, "DAMAS DO FUTURO", "THE GIRLS"),
      disputa("sumo-g1", 11, "UMIBOTS", "ÔMEGA"),
      disputa("sumo-g1", 12, "Tancredo Neves", "Tech Dragons - EMPA"),
      disputa("sumo-g1", 13, "DAMAS DO FUTURO", "ÔMEGA"),
      disputa("sumo-g1", 14, "THE GIRLS", "Tech Dragons - EMPA"),
      disputa("sumo-g1", 15, "UMIBOTS", "Tancredo Neves"),
    ],
  },
  {
    id: "sumo-g2",
    name: "Grupo 2",
    teams: ["TW ALFA", "Paiva Bots", "C7 Volt", "CYBERSQUAD", "CraftBots", "Grupo LPD"],
    matches: [
      disputa("sumo-g2", 1, "TW ALFA", "Grupo LPD"),
      disputa("sumo-g2", 2, "Paiva Bots", "CraftBots"),
      disputa("sumo-g2", 3, "C7 Volt", "CYBERSQUAD"),
      disputa("sumo-g2", 4, "TW ALFA", "CraftBots"),
      disputa("sumo-g2", 5, "Grupo LPD", "CYBERSQUAD"),
      disputa("sumo-g2", 6, "Paiva Bots", "C7 Volt"),
      disputa("sumo-g2", 7, "TW ALFA", "CYBERSQUAD"),
      disputa("sumo-g2", 8, "CraftBots", "C7 Volt"),
      disputa("sumo-g2", 9, "Grupo LPD", "Paiva Bots"),
      disputa("sumo-g2", 10, "TW ALFA", "C7 Volt"),
      disputa("sumo-g2", 11, "CYBERSQUAD", "Paiva Bots"),
      disputa("sumo-g2", 12, "CraftBots", "Grupo LPD"),
      disputa("sumo-g2", 13, "TW ALFA", "Paiva Bots"),
      disputa("sumo-g2", 14, "C7 Volt", "Grupo LPD"),
      disputa("sumo-g2", 15, "CYBERSQUAD", "CraftBots"),
    ],
  },
];

const corridaTeams = [
  "QUINTETO FANTÁSTICO",
  "THE GIRLS",
  "CraftBots",
  "UMIBOTS",
  "Garotas da programação",
  "TW Alfa",
  "Eagles One",
  "ROBÔGIRLS",
  "Tira Tec",
  "C7 Volt",
  "Tech Dragons - EMPA",
  "FreiPro Robotics",
  "CYBERSQUAD",
  "TEAM DEAFT POWER",
  "Eagles Two",
  "Tancredo Neves",
  "Las Robochicas",
  "Grupo LPD",
];

export const modalities: Modality[] = [
  {
    id: "caca-balao",
    name: "Caça-balão",
    blurb: "16 equipes · 4 grupos · todos contra todos",
    kind: "bracket",
    groups: cacaGroups,
    rounds: eliminatorias("caca"),
  },
  {
    id: "sumo",
    name: "Sumô",
    blurb: "12 equipes · 2 grupos de 6 · todos contra todos",
    kind: "bracket",
    groups: sumoGroups,
    rounds: eliminatorias("sumo"),
  },
  {
    id: "corrida",
    name: "Corrida com obstáculos",
    blurb: "18 equipes · ordem de largada",
    kind: "race",
    teams: corridaTeams.map((name, index) => ({
      id: `corrida-${index + 1}`,
      order: index + 1,
      name,
    })),
  },
];

export function findModality(id: string): Modality | undefined {
  return modalities.find((item) => item.id === id);
}

export function findMatch(modality: BracketModality, matchId: string): { match: Match; context: string } | undefined {
  for (const group of modality.groups) {
    const match = group.matches.find((item) => item.id === matchId);
    if (match) return { match, context: group.name };
  }
  for (const round of modality.rounds) {
    const match = round.matches.find((item) => item.id === matchId);
    if (match) return { match, context: round.name };
  }
  return undefined;
}
