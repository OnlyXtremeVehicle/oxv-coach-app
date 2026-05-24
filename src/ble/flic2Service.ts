/**
 * Service Flic 2 — bouton BLE de marquage manuel.
 *
 * V1 STUB intentionnel : la vraie intégration Flic 2 passe par leur
 * SDK natif (FlicLib pour iOS, fliclib-android), pas par BLE pur — leurs
 * caractéristiques BLE ne sont pas documentées publiquement. Pour la V1,
 * ce service expose l'API publique attendue (scan/connect/onClick) et
 * laisse `simulateClick()` pour valider le flow downstream (marqueurs
 * dans useSessionStore, affichage debug).
 *
 * Roadmap V2 : extraire en expo dev module qui wrap FlicLib natif.
 * L'API publique de ce fichier ne devra pas changer.
 */

import type { LapMarkerKind } from '@/types/domain';

export type Flic2Status = 'idle' | 'scanning' | 'connected' | 'disconnected';

type ClickListener = (kind: LapMarkerKind, at: number) => void;
type StatusListener = (status: Flic2Status) => void;

class Flic2Service {
  private status: Flic2Status = 'idle';
  private clickListeners: ClickListener[] = [];
  private statusListeners: StatusListener[] = [];
  private currentButtonId: string | null = null;

  public onClick(listener: ClickListener): () => void {
    this.clickListeners.push(listener);
    return () => {
      this.clickListeners = this.clickListeners.filter((l) => l !== listener);
    };
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  public getStatus(): Flic2Status {
    return this.status;
  }

  public getConnectedButtonId(): string | null {
    return this.currentButtonId;
  }

  public async scan(): Promise<void> {
    this.setStatus('scanning');
    if (__DEV__) {
      console.warn(
        '[OXV Flic] V1 stub : pas de scan BLE réel. Utiliser simulateClick(kind) pour tester.'
      );
    }
    // Simule un scan court qui ne trouve rien.
    setTimeout(() => {
      if (this.status === 'scanning') this.setStatus('idle');
    }, 1_500);
  }

  public async connect(buttonId: string): Promise<void> {
    this.currentButtonId = buttonId;
    this.setStatus('connected');
  }

  public async disconnect(): Promise<void> {
    this.currentButtonId = null;
    this.setStatus('disconnected');
  }

  /**
   * Pour tester le flow sans matériel : déclenche un clic synthétique.
   * Tous les `onClick` listeners sont appelés comme pour un vrai clic.
   */
  public simulateClick(kind: LapMarkerKind): void {
    const at = Date.now();
    for (const listener of this.clickListeners) listener(kind, at);
  }

  private setStatus(s: Flic2Status): void {
    this.status = s;
    for (const listener of this.statusListeners) listener(s);
  }
}

export const flic2Service = new Flic2Service();
