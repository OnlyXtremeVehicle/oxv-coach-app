/**
 * Store des états d'interface OXV Coach.
 *
 * Tout ce qui est "comment l'app se présente" sans toucher au métier :
 * overlays (offline, ble error, update), mode du hub (#20), bannière
 * notifications, etc.
 *
 * Découplé de [[useAppStateStore]] : un changement de UI ne change
 * pas la state machine, et inversement.
 */

import { create } from 'zustand';

import { HomeHubMode } from '@/types/domain';

interface UIStore {
  /** Mode actuel du hub #20 (computed côté composant à partir du state + position). */
  hubMode: HomeHubMode;
  /** Si vrai, on superpose la bannière jaune offline (#26). */
  offlineBannerVisible: boolean;
  /** Si vrai, modal #25 BLE error visible. */
  bleErrorModalVisible: boolean;
  /** Si vrai, modal #27 update disponible visible. */
  updateModalVisible: boolean;
  /** Si vrai, badge rouge sur l'icône notifications de la topbar. */
  notificationsBadgeVisible: boolean;
  /** Compteur — sert au badge "À traiter" sur #23. */
  unreadNotificationsCount: number;

  setHubMode: (mode: HomeHubMode) => void;
  setOfflineBannerVisible: (visible: boolean) => void;
  setBleErrorModalVisible: (visible: boolean) => void;
  setUpdateModalVisible: (visible: boolean) => void;
  setUnreadNotificationsCount: (count: number) => void;
  reset: () => void;
}

const initialState = {
  hubMode: 'passive' as HomeHubMode,
  offlineBannerVisible: false,
  bleErrorModalVisible: false,
  updateModalVisible: false,
  notificationsBadgeVisible: false,
  unreadNotificationsCount: 0,
};

export const useUIStore = create<UIStore>((set) => ({
  ...initialState,

  setHubMode: (hubMode) => set({ hubMode }),

  setOfflineBannerVisible: (offlineBannerVisible) => set({ offlineBannerVisible }),

  setBleErrorModalVisible: (bleErrorModalVisible) => set({ bleErrorModalVisible }),

  setUpdateModalVisible: (updateModalVisible) => set({ updateModalVisible }),

  setUnreadNotificationsCount: (count) =>
    set({
      unreadNotificationsCount: count,
      notificationsBadgeVisible: count > 0,
    }),

  reset: () => set({ ...initialState }),
}));
