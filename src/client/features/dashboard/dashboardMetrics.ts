import type { ClassItem, ContractType, TeacherItem } from '../../types/api.ts';

export interface ClassEnrollmentChartPoint {
  id: number;
  name: string;
  levelName: string;
  inscrits: number;
  placesLibres: number;
  capacite: number;
  occupancyPct: number;
}

export interface TeacherDistributionPoint {
  key: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface CapacitySummary {
  totalEnrolled: number;
  totalCapacity: number;
  occupancyPct: number;
  classCount: number;
}

const CHART_PALETTE = [
  '#4F46E5', // Indigo 600
  '#0F172A', // Slate 900
  '#0D9488', // Teal 600
  '#D97706', // Amber 600
  '#2563EB', // Blue 600
  '#64748B', // Slate 500
];

const CONTRACT_LABELS: Record<ContractType, string> = {
  PERMANENT: 'Titulaires',
  CONTRACT: 'Contractuels',
  PART_TIME: 'Vacataires',
};

export function buildClassEnrollmentChartData(
  classes: ClassItem[],
  academicYearId?: number | null
): ClassEnrollmentChartPoint[] {
  const filtered = classes.filter((c) => {
    if (c.isArchived) return false;
    if (academicYearId && c.academicYearId !== academicYearId) return false;
    return true;
  });

  return filtered.map((c) => {
    const inscrits = Math.max(0, c.enrolledCount);
    const capacite = Math.max(0, c.capacity);
    const placesLibres = Math.max(0, capacite - inscrits);
    const occupancyPct = capacite > 0 ? Math.round((inscrits / capacite) * 100) : 0;

    return {
      id: c.id,
      name: c.name,
      levelName: c.levelName,
      inscrits,
      placesLibres,
      capacite,
      occupancyPct,
    };
  });
}

export function computeCapacitySummary(
  points: ClassEnrollmentChartPoint[]
): CapacitySummary {
  const totalEnrolled = points.reduce((acc, p) => acc + p.inscrits, 0);
  const totalCapacity = points.reduce((acc, p) => acc + p.capacite, 0);
  const occupancyPct =
    totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

  return {
    totalEnrolled,
    totalCapacity,
    occupancyPct,
    classCount: points.length,
  };
}

export function buildTeacherDistributionData(
  teachers: TeacherItem[],
  groupBy: 'specialty' | 'contract',
  onlyActive = true
): TeacherDistributionPoint[] {
  const pool = onlyActive ? teachers.filter((t) => t.isActive) : teachers;
  if (pool.length === 0) return [];

  const counts = new Map<string, { label: string; count: number }>();

  for (const t of pool) {
    const rawKey =
      groupBy === 'specialty'
        ? t.specialty.trim() || 'Non renseignée'
        : t.contractType;
    const label =
      groupBy === 'specialty' ? rawKey : CONTRACT_LABELS[t.contractType] ?? rawKey;

    const existing = counts.get(rawKey);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(rawKey, { label, count: 1 });
    }
  }

  const sorted = Array.from(counts.entries())
    .map(([key, info]) => ({ key, ...info }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr'));

  // Group tail specialties beyond top 5 into "Autres spécialités" for readability
  const normalized =
    groupBy === 'specialty' && sorted.length > 5
      ? [
          ...sorted.slice(0, 5),
          {
            key: '__other__',
            label: 'Autres spécialités',
            count: sorted.slice(5).reduce((sum, item) => sum + item.count, 0),
          },
        ]
      : sorted;

  const total = pool.length;
  return normalized.map((item, idx) => ({
    key: item.key,
    label: item.label,
    count: item.count,
    percentage: Math.round((item.count / total) * 100),
    color: CHART_PALETTE[idx % CHART_PALETTE.length],
  }));
}
