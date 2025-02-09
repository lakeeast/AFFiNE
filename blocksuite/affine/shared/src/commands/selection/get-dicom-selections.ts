import { DicomSelection } from '../../selection/index.js';
import type { GetSelectionCommand } from './types.js';

export const getDicomSelectionsCommand: GetSelectionCommand = (ctx, next) => {
  const currentDicomSelections = ctx.std.selection.filter(DicomSelection);
  if (currentDicomSelections.length === 0) return;

  next({ currentDicomSelections });
};
