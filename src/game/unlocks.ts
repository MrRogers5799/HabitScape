/**
 * What each skill level unlocks, built from the content: methods and recipes, gear to wear,
 * tools to use, quests to start. Shared by the skill guide (PROD-030) and the level-up notice
 * in the log (owner note 2026-11-22, #11: "levelled up a skill? show what new things they
 * unlocked").
 */
import { ITEMS, METHODS, QUESTS } from './content/valley';
import { regionName } from './labels';
import { GameSkill, ItemId, ToolType } from './types';

export interface SkillUnlock {
  key: string;
  level: number;
  title: string;
  kind: 'method' | 'wear' | 'tool' | 'quest';
  /** The item to picture it with, if any. */
  icon?: ItemId;
  detail?: string;
}

const TOOL_SKILL: Record<ToolType, GameSkill> = { pickaxe: 'Mining', hatchet: 'Woodcutting', small_net: 'Fishing', fishing_rod: 'Fishing' };

export function skillUnlocks(skill: GameSkill): SkillUnlock[] {
  const out: SkillUnlock[] = [];
  for (const m of Object.values(METHODS)) {
    if (m.skill !== skill || m.id.startsWith('melt-')) continue;
    out.push({
      key: m.id, level: m.level, title: m.name, kind: 'method',
      icon: m.output ?? (m.kind === 'process' ? Object.keys(m.inputs)[0] : undefined),
      detail: `${m.xpEach} XP each · ${m.regions.map(regionName).join(', ')}`,
    });
  }
  for (const item of Object.values(ITEMS)) {
    if (item.equip?.wear.skill === skill) {
      out.push({ key: `wear-${item.id}`, level: item.equip.wear.level, title: `Wear ${item.name.toLowerCase()}`, kind: 'wear', icon: item.id });
    }
    if (item.tool && TOOL_SKILL[item.tool.type] === skill && item.tool.level > 1) {
      out.push({ key: `tool-${item.id}`, level: item.tool.level, title: `Use ${item.name.toLowerCase()}`, kind: 'tool', icon: item.id });
    }
  }
  for (const q of Object.values(QUESTS)) {
    const req = q.requirements.find((r) => r.kind === 'skill' && r.skill === skill);
    if (req && req.kind === 'skill') out.push({ key: `quest-${q.id}`, level: req.level, title: `Quest: ${q.name}`, kind: 'quest' });
  }
  return out.sort((a, b) => a.level - b.level || a.title.localeCompare(b.title));
}

/** What became available between two levels (above `from`, up to and including `to`). */
export const unlocksBetween = (skill: GameSkill, from: number, to: number): SkillUnlock[] =>
  skillUnlocks(skill).filter((u) => u.level > from && u.level <= to);
