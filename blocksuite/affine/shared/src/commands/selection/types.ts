import type {
  BlockSelection,
  Command,
  TextSelection,
} from '@blocksuite/block-std';

import type { DicomSelection } from '../../selection/dicom';
import type { ImageSelection } from '../../selection/image';
export type GetSelectionCommand = Command<
  {},
  {
    currentTextSelection?: TextSelection;
    currentBlockSelections?: BlockSelection[];
    currentImageSelections?: ImageSelection[];
    currentDicomSelections?: DicomSelection[];
  }
>;
