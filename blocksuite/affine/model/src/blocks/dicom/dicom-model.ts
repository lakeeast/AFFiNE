import type {
  GfxCommonBlockProps,
  GfxElementGeometry,
} from '@blocksuite/block-std/gfx';
import { GfxCompatible } from '@blocksuite/block-std/gfx';
import { BlockModel, defineBlockSchema } from '@blocksuite/store';

import { DicomBlockTransformer } from './dicom-transformer.js';

export type DicomBlockProps = {
  caption?: string;
  sourceId?: string;
  width?: number;
  height?: number;
  rotate: number;
  size?: number;
} & Omit<GfxCommonBlockProps, 'scale'>;

const defaultDicomProps: DicomBlockProps = {
  caption: '',
  sourceId: '',
  width: 0,
  height: 0,
  index: 'a0',
  xywh: '[0,0,0,0]',
  lockedBySelf: false,
  rotate: 0,
  size: -1,
};

export const DicomBlockSchema = defineBlockSchema({
  flavour: 'affine:dicom',
  props: () => defaultDicomProps,
  metadata: {
    version: 1,
    role: 'content',
  },
  transformer: () => new DicomBlockTransformer(),
  toModel: () => new DicomBlockModel(),
});

export class DicomBlockModel
  extends GfxCompatible<DicomBlockProps>(BlockModel)
  implements GfxElementGeometry {}

declare global {
  namespace BlockSuite {
    interface BlockModels {
      'affine:dicom': DicomBlockModel;
    }
    interface EdgelessBlockModelMap {
      'affine:dicom': DicomBlockModel;
    }
  }
}
