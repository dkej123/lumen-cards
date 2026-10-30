// Browser APIs happy-dom does not have (cards observe their size and visibility).
import { vi } from "vitest";

vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
