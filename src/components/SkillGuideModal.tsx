import React from 'react';
import {
  View,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ACTIVITY_TEMPLATES } from '../constants/activities';
import { SKILL_DESCRIPTIONS, SKILL_ICONS } from '../constants/osrsSkills';
import { fonts } from '../constants/typography';

interface SkillGuideModalProps {
  skill: string | null;
  onClose: () => void;
  onAddActivity: () => void;
}

const P = {
  parchment:     '#f2dfa0',
  parchmentAlt:  '#edd890',
  header:        '#e0c060',
  border:        '#7a5c10',
  borderInner:   '#c4a040',
  ink:           '#2c1800',
  inkMed:        '#5a3010',
  inkLight:      '#8b6030',
  separator:     '#c4a050',
};

export function SkillGuideModal({ skill, onClose, onAddActivity }: SkillGuideModalProps) {
  if (!skill) return null;

  const activities = ACTIVITY_TEMPLATES.filter(a => a.skillId === skill);
  const theme = SKILL_DESCRIPTIONS[skill] ?? '';

  return (
    <Modal visible={!!skill} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>

        {/* Outer parchment border */}
        <View style={styles.outerBorder}>
          <View style={styles.innerBorder}>

            {/* Header — skill icon + name + close */}
            <View style={styles.header}>
              {SKILL_ICONS[skill] && (
                <Image source={SKILL_ICONS[skill]} style={styles.skillIcon} resizeMode="contain" />
              )}
              <Text style={styles.skillName}>{skill}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Theme description */}
            <View style={styles.themeRow}>
              <Text style={styles.themeText}>{theme}</Text>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Add activity CTA */}
            <TouchableOpacity style={styles.addBtn} onPress={onAddActivity}>
              <Text style={styles.addBtnText}>+ Track an Activity</Text>
            </TouchableOpacity>

            {/* Activity list */}
            <ScrollView style={styles.list} showsVerticalScrollIndicator>
              {activities.map((activity, i) => (
                <View
                  key={activity.id}
                  style={[styles.row, i % 2 === 1 && styles.rowAlt]}
                >
                  <Text style={styles.activityName}>{activity.activityName}</Text>
                  <Text style={styles.activityDesc}>{activity.description}</Text>
                  <Text style={styles.activityXP}>{activity.baseXP} XP</Text>
                </View>
              ))}
              {activities.length === 0 && (
                <View style={styles.row}>
                  <Text style={styles.activityDesc}>No activities yet for this skill.</Text>
                </View>
              )}
            </ScrollView>

          </View>
        </View>

      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: P.parchment,
  },
  outerBorder: {
    flex: 1,
    margin: 10,
    borderWidth: 3,
    borderColor: P.border,
    backgroundColor: P.parchment,
  },
  innerBorder: {
    flex: 1,
    borderWidth: 1,
    borderColor: P.borderInner,
    margin: 3,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.header,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: P.border,
    gap: 10,
  },
  skillIcon: { width: 26, height: 26 },
  skillName: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 11,
    color: P.ink,
    textAlign: 'center',
  },
  closeBtn: { paddingHorizontal: 4 },
  closeBtnText: { fontFamily: fonts.display, fontSize: 22, color: P.inkMed },

  // Theme
  themeRow: {
    backgroundColor: P.header,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: P.border,
    alignItems: 'center',
  },
  themeText: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: P.inkMed,
    textAlign: 'center',
  },

  addBtn: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: P.border,
    borderWidth: 1,
    borderColor: P.ink,
  },
  addBtnText: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: P.parchment,
  },
  divider: {
    height: 1,
    backgroundColor: P.separator,
    marginHorizontal: 6,
    marginVertical: 3,
  },

  // List
  list: { flex: 1 },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: P.separator,
    backgroundColor: P.parchment,
  },
  rowAlt: { backgroundColor: P.parchmentAlt },
  activityName: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: P.ink,
    marginBottom: 2,
  },
  activityDesc: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: P.inkMed,
  },
  activityXP: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: P.inkLight,
    marginTop: 3,
  },
});
