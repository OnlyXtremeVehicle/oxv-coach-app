/**
 * Shim minimal de types pour `expo-print` en attendant que la dépendance
 * soit installée localement (ajoutée à package.json dans la PR PDF
 * export, l'install se fait via `npx expo install` au moment du build).
 *
 * À supprimer une fois `npm install` exécuté et que les types officiels
 * d'expo-print sont disponibles.
 */

declare module 'expo-print' {
  export interface PrintToFileOptions {
    html: string;
    base64?: boolean;
    width?: number;
    height?: number;
    margins?: { left?: number; top?: number; right?: number; bottom?: number };
  }

  export interface PrintToFileResult {
    uri: string;
    numberOfPages: number;
    base64?: string;
  }

  export function printToFileAsync(options: PrintToFileOptions): Promise<PrintToFileResult>;
  export function printAsync(options: PrintToFileOptions): Promise<void>;
}
