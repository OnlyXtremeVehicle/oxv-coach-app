/**
 * Garage — véhicules du pilote + accès au journal de réglages (M3).
 *
 * Mémoire matérielle : relier la donnée au matériel. Doctrine : sobre,
 * vouvoiement, pas d'emoji, or = donnée, aucun jugement sur les réglages.
 */

import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/instruments';
import { type Vehicle, addVehicle, listMyVehicles } from '@/services/garageService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

function vehicleLabel(v: Vehicle): string {
  const base = [v.brand, v.model].filter(Boolean).join(' ').trim() || 'Véhicule';
  return v.year ? `${base} (${v.year})` : base;
}

export default function GarageScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listMyVehicles().then((rows) => {
      if (!cancelled) {
        setVehicles(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(reload);

  async function onAdd() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const y = parseInt(year, 10);
    const res = await addVehicle({
      brand,
      model,
      year: Number.isFinite(y) ? y : null,
      color: color || undefined,
    });
    setSaving(false);
    if (res.ok) {
      setComposing(false);
      setBrand('');
      setModel('');
      setYear('');
      setColor('');
      reload();
    } else {
      setError(res.error ?? 'Création impossible.');
    }
  }

  return (
    <Screen>
      <AppBar title="GARAGE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>VOTRE MATÉRIEL</Text>
        <Text style={s.title} accessibilityRole="header">
          Vos véhicules.
        </Text>

        {!composing ? (
          <View style={{ marginTop: theme.spacing.xl }}>
            <Button label="Ajouter un véhicule" onPress={() => setComposing(true)} />
          </View>
        ) : (
          <Card style={{ marginTop: theme.spacing.xl, gap: theme.spacing.md }}>
            <SectionLabel>Nouveau véhicule</SectionLabel>
            <Field label="Marque" value={brand} onChangeText={setBrand} />
            <Field label="Modèle" value={model} onChangeText={setModel} />
            <Field
              label="Année"
              optional
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
            />
            <Field label="Couleur" optional value={color} onChangeText={setColor} />
            {error ? (
              <Text style={s.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            <Button
              label="Enregistrer"
              onPress={onAdd}
              loading={saving}
              disabled={!brand.trim() || !model.trim()}
            />
            <Button label="Annuler" variant="ghost" onPress={() => setComposing(false)} />
          </Card>
        )}

        <View style={{ marginTop: theme.spacing.xxl, gap: theme.spacing.sm }}>
          {!loading && vehicles.length === 0 ? (
            <EmptyState
              label="Aucun véhicule"
              message="Ajoutez un véhicule pour consigner ses réglages."
              source="vehicles"
            />
          ) : (
            vehicles.map((v) => (
              <Card
                key={v.id}
                onPress={() => router.push(`/(app)/garage/${v.id}` as never)}
                accessibilityLabel={vehicleLabel(v)}
              >
                <Text style={s.vName}>{vehicleLabel(v)}</Text>
                {v.color ? <Text style={s.vMeta}>{v.color}</Text> : null}
              </Card>
            ))
          )}
        </View>
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
  },
  vName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  vMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  error: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.red,
  },
};
