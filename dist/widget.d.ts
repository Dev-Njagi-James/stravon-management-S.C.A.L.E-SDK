import { c as StorageUsageReport } from './errors-CNOCEp24.js';

interface UsageWidgetBrand {
    /** Ring and icon. Default Stravon navy #002147. */
    accent?: string;
    /** Upgrade/Renew button background. Default Stravon gold #d4af37. */
    action?: string;
    /** Upgrade/Renew button text. Default #111111. */
    actionInk?: string;
    /** Text color. Default #002147. */
    ink?: string;
    /** Card background. Default cream #f6f4eb. */
    surface?: string;
    /** CSS font-family. Default Inter, system-ui. The host app must load Inter. */
    font?: string;
    /** Card corner radius, e.g. "16px". */
    radius?: string;
}
interface UsageWidgetOptions {
    /** Must resolve to a StorageUsageReport. Do NOT call the SDK with a raw API key in a browser; point this at your own backend route. */
    fetchUsage: () => Promise<StorageUsageReport>;
    /** Poll interval in ms. 0 disables polling. Values between 1 and 4999 are raised to 5000. Default 60000. */
    refreshMs?: number;
    brand?: UsageWidgetBrand;
    title?: string;
    onUpgrade?: () => void;
    onError?: (err: unknown) => void;
}
interface UsageWidgetHandle {
    refresh(): Promise<void>;
    destroy(): void;
}
/** Server-side helper: adapts a ScaleClient to the fetchUsage shape. */
declare function usageFromClient(client: {
    storage: {
        usage(): Promise<StorageUsageReport>;
    };
}): () => Promise<StorageUsageReport>;
declare function mountUsageWidget(target: HTMLElement | string, opts: UsageWidgetOptions): UsageWidgetHandle;

export { type UsageWidgetBrand, type UsageWidgetHandle, type UsageWidgetOptions, mountUsageWidget, usageFromClient };
