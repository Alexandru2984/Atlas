export type MythNodeType = 'deity' | 'hero' | 'artifact' | 'realm' | 'event';

export type MythNode = {
  id: string;
  label: string;
  type: MythNodeType;
  era: string;
  summary: string;
};

export type MythEdge = {
  id: string;
  source: string;
  target: string;
  relation: string;
  weight: number;
};

export const mythNodes: MythNode[] = [
  {
    id: 'n-aetherion',
    label: 'Aetherion',
    type: 'deity',
    era: 'Dawn Age',
    summary: 'A storm-forger deity said to tune thunder into prophecies.'
  },
  {
    id: 'n-sylvar',
    label: 'Sylvar of Reed',
    type: 'hero',
    era: 'Bronze Tide',
    summary: 'A navigator-hero who crossed a sea that shifted each moon.'
  },
  {
    id: 'n-lumen-vein',
    label: 'Lumen Vein',
    type: 'artifact',
    era: 'Dawn Age',
    summary: 'Crystal spindle that stores memory as songs.'
  },
  {
    id: 'n-ember-gate',
    label: 'Ember Gate',
    type: 'realm',
    era: 'Iron Bloom',
    summary: 'Volcanic citadel where oaths are measured in ash.'
  },
  {
    id: 'n-night-harvest',
    label: 'Night Harvest',
    type: 'event',
    era: 'Iron Bloom',
    summary: 'A nine-day eclipse during which stars fell into rivers.'
  },
  {
    id: 'n-mirea',
    label: 'Mirea Threadkeeper',
    type: 'hero',
    era: 'Glass Epoch',
    summary: 'Archivist who weaves biographies into ceremonial cloth.'
  }
];

export const mythEdges: MythEdge[] = [
  {
    id: 'e-1',
    source: 'n-aetherion',
    target: 'n-lumen-vein',
    relation: 'forged',
    weight: 4
  },
  {
    id: 'e-2',
    source: 'n-sylvar',
    target: 'n-lumen-vein',
    relation: 'sought',
    weight: 3
  },
  {
    id: 'e-3',
    source: 'n-sylvar',
    target: 'n-ember-gate',
    relation: 'entered',
    weight: 2
  },
  {
    id: 'e-4',
    source: 'n-night-harvest',
    target: 'n-ember-gate',
    relation: 'reshaped',
    weight: 5
  },
  {
    id: 'e-5',
    source: 'n-mirea',
    target: 'n-night-harvest',
    relation: 'documented',
    weight: 3
  },
  {
    id: 'e-6',
    source: 'n-aetherion',
    target: 'n-sylvar',
    relation: 'anointed',
    weight: 2
  }
];