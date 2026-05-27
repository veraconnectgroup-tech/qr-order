/** L2 Kernel — belief fold (M2 minimal; full engine M3+). */
export {
  emptyMinimalBeliefs,
  foldMinimalBeliefs,
  replayMinimalBeliefs,
} from "@/lib/denis/kernel/fold-beliefs";
export type {
  Belief,
  BeliefSource,
  DenisMinimalBeliefs,
} from "@/lib/denis/kernel/fold-beliefs";

export const DENIS_KERNEL_LAYER = "kernel" as const;
