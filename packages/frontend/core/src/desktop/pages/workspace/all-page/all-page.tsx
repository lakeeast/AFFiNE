import { useBlockSuiteDocMeta } from '@affine/core/components/hooks/use-block-suite-page-meta';
import {
  PageListHeader,
  useFilteredPageMetas,
  VirtualizedPageList,
} from '@affine/core/components/page-list';
import { GlobalContextService } from '@affine/core/modules/global-context';
import { WorkspaceService } from '@affine/core/modules/workspace';
import type { Filter } from '@affine/env/filter';
import { useI18n } from '@affine/i18n';
import { useService } from '@toeverything/infra';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import {
  useIsActiveView,
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '../../../../modules/workbench';
import { EmptyPageList } from '../page-list-empty';
import * as styles from './all-page.css';
import { FilterContainer } from './all-page-filter';
import { AllPageHeader } from './all-page-header';

export const AllPage = () => {
  const currentWorkspace = useService(WorkspaceService).workspace;
  const globalContext = useService(GlobalContextService).globalContext;
  const pageMetas = useBlockSuiteDocMeta(currentWorkspace.docCollection);
  const [hideHeaderCreateNew, setHideHeaderCreateNew] = useState(true);
  const [filters, setFilters] = useState<Filter[]>([]);
  const filteredPageMetas = useFilteredPageMetas(pageMetas, { filters });
  const isActiveView = useIsActiveView();
  const location = useLocation();
  const t = useI18n();

  // Debugging: Log when component mounts
  console.log('AllPage component rendering, isActiveView:', isActiveView, 'location:', location.pathname);

  // Post url-changed message on mount and URL change
  useEffect(() => {
    console.log('AllPage useEffect running, isActiveView:', isActiveView, 'posting url-changed message');
    window.parent.postMessage(
      {
        type: 'url-changed',
        payload: 'all',
      },
      '*' // Replace with Angular app's origin in production (e.g., 'http://parent-origin.com')
    );

    if (isActiveView) {
      globalContext.isAllDocs.set(true);
      return () => {
        globalContext.isAllDocs.set(false);
      };
    }
  }, [globalContext, isActiveView, location.pathname]);

  return (
    <>
      <ViewTitle title={t['All pages']()} />
      <ViewIcon icon="allDocs" />
      <ViewHeader>
        <AllPageHeader
          showCreateNew={!hideHeaderCreateNew}
          filters={filters}
          onChangeFilters={setFilters}
        />
      </ViewHeader>
      <ViewBody>
        <div className={styles.body}>
          <FilterContainer filters={filters} onChangeFilters={setFilters} />
          {filteredPageMetas.length > 0 ? (
            <VirtualizedPageList
              setHideHeaderCreateNewPage={setHideHeaderCreateNew}
              filters={filters}
            />
          ) : (
            <EmptyPageList type="all" heading={<PageListHeader />} />
          )}
        </div>
      </ViewBody>
    </>
  );
};

export const Component = () => {
  return <AllPage />;
};