import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { useFilter } from '@/context/FilterContext';
import { ProgressiveCategorySelector } from '@/components/filter/ProgressiveCategorySelector';
import { DateRangeFilter } from '@/components/filter/DateRangeFilter';
import { ActivitiesTable } from '@/components/activity/ActivitiesTable';
import { ExcelExportModal } from '@/components/activity/ExcelExportModal';
import { ExcelImportModal } from '@/components/activity/ExcelImportModal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { Category } from '@/types/database';
import type { UUID } from '@/types';

// --------------------------------------------
// Icons
// --------------------------------------------

const LogoutIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const StructureIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const ActivitiesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const AddIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const FolderIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
  </svg>
);

// --------------------------------------------
// Tab Types
// --------------------------------------------

type TabType = 'activities' | 'structure';

// --------------------------------------------
// Main Content (inside FilterProvider)
// --------------------------------------------

function AppContent() {
  const nav = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('activities');
  
  // Get filter context
  const { 
    filter, 
    isLeafCategory, 
    fullPathDisplay, 
    hasActiveFilter, 
    reset
  } = useFilter();
  
  // Responsive state
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  // Collapse filter when returning from View/Edit (collapseFilter flag in location.state)
  const [isFilterExpanded, setIsFilterExpanded] = useState(() => {
    const state = location.state as { collapseFilter?: boolean } | null;
    return !state?.collapseFilter;
  });

  // Get user email
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? '');
    });
  }, []);

  // Handle resize – only react to WIDTH changes (orientation change).
  // On Android, opening the virtual keyboard fires a resize event but only
  // changes window.innerHeight (viewport shrinks). We must NOT collapse the
  // filter in that case, otherwise opening the Save Shortcut modal (which
  // has autoFocus → triggers keyboard) closes the filter behind the modal.
  useEffect(() => {
    let lastWidth = window.innerWidth;

    const handleResize = () => {
      const newWidth = window.innerWidth;
      const widthChanged = newWidth !== lastWidth;
      lastWidth = newWidth;

      const mobile = newWidth < 768;
      setIsMobile(mobile);

      // Collapse filter only on actual orientation/layout change (width changed),
      // NOT on keyboard popup (height-only change).
      if (widthChanged && mobile && hasActiveFilter) {
        setIsFilterExpanded(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [hasActiveFilter]);

  // Sign out handler
  const onSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Signed out');
      nav('/login');
    }
  };

  // Handle leaf category selection - show toast
  const handleLeafSelected = (_category: Category, path: Category[]) => {
    toast.success(`✓ Category selected: ${path.map(c => c.name).join(' > ')}`);
    if (isMobile) {
      setIsFilterExpanded(false);
    }
  };

  // Can add activity only when leaf category is selected
  const canAddActivity = isLeafCategory;

  // Navigate to Add Activity
  const handleAddActivity = () => {
    if (!canAddActivity) {
      toast.error('Please select a leaf category first');
      return;
    }
    nav('/app/add', {
      state: {
        areaId: filter.areaId,
        categoryId: filter.categoryId,
        categoryPath: fullPathDisplay.split(' > ')  // Includes Area name
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex flex-col">
      {/* ========================================
          HEADER - Fixed at top
          ======================================== */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-12 sm:h-14">
            {/* Logo / Title */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs sm:text-sm">ET</span>
              </div>
              <h1 className="font-semibold text-gray-900 text-sm sm:text-base hidden sm:block">
                Events Tracker
              </h1>
            </div>

            {/* Full Path Display - Center */}
            <div className="flex-1 mx-2 sm:mx-4 min-w-0">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-lg truncate">
                <FolderIcon />
                <span className="truncate">{fullPathDisplay || 'No selection'}</span>
              </div>
            </div>

            {/* User section */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 hidden md:block truncate max-w-[120px]">
                {email}
              </span>
              <button
                onClick={onSignOut}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Sign out"
              >
                <LogoutIcon />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================
          MAIN CONTENT
          ======================================== */}
      <main className="flex-1 flex flex-col max-w-7xl w-full mx-auto px-3 sm:px-6 py-3 sm:py-4">
        
        {/* ========================================
            FILTER SECTION - Collapsible on mobile
            ======================================== */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 mb-3 sm:mb-4">
          {/* Filter Header */}
          <div 
            className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 cursor-pointer"
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          >
            <div className="flex items-center gap-2">
              <h2 className="font-medium text-gray-900 text-sm sm:text-base">Filter</h2>
            </div>
            
            <div className="flex items-center gap-2">
              {hasActiveFilter && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    reset();
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1"
                >
                  Clear all
                </button>
              )}
              <span className="text-gray-400">
                {isFilterExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
              </span>
            </div>
          </div>

          {/* Filter Content */}
          {isFilterExpanded && (
            <div className="px-3 pb-3 sm:px-4 sm:pb-4 border-t border-gray-100 pt-3">
              <ProgressiveCategorySelector
                onLeafSelected={handleLeafSelected}
              />
              
              {/* Date Range Filter - only for Activities tab */}
              {activeTab === 'activities' && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <DateRangeFilter />
                </div>
              )}
            </div>
          )}
        </section>

        {/* ========================================
            TABS + ADD BUTTON
            ======================================== */}
        <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
          {/* Tabs */}
          <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-100">
            <TabButton
              active={activeTab === 'activities'}
              onClick={() => setActiveTab('activities')}
              icon={<ActivitiesIcon />}
              label="Activities"
              isMobile={isMobile}
            />
            <TabButton
              active={activeTab === 'structure'}
              onClick={() => setActiveTab('structure')}
              icon={<StructureIcon />}
              label="Structure"
              isMobile={isMobile}
            />
          </div>

          {/* Add Activity Button */}
          <Button
            leftIcon={<AddIcon />}
            onClick={handleAddActivity}
            disabled={!canAddActivity}
            className={cn(
              "transition-all",
              canAddActivity 
                ? "bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200" 
                : ""
            )}
          >
            {isMobile ? '' : 'Add Activity'}
          </Button>
        </div>

        {/* Leaf category hint */}
        {!canAddActivity && filter.categoryId && (
          <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            ⚠️ Select a leaf category (no subcategories) to add an activity
          </div>
        )}

        {/* ========================================
            TAB CONTENT
            overflow-hidden NAMJERNO UKLONJEN - klipao bi dropdown menije u ActivitiesTable
            ======================================== */}
        <section className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          {activeTab === 'structure' ? (
            <StructureView />
          ) : (
            <ActivitiesView />
          )}
        </section>
      </main>
    </div>
  );
}

// --------------------------------------------
// Tab Button Component
// --------------------------------------------

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  isMobile: boolean;
}

function TabButton({ active, onClick, icon, label, isMobile }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-sm font-medium transition-colors',
        active
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      )}
    >
      {icon}
      {!isMobile && <span>{label}</span>}
    </button>
  );
}

// --------------------------------------------
// Structure View (placeholder)
// --------------------------------------------

function StructureView() {
  const { filter } = useFilter();

  return (
    <div className="p-4 sm:p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Structure View</h3>

      {filter.areaId || filter.categoryId ? (
        <div className="space-y-4">
          <p className="text-gray-600">
            Selected: {filter.categoryId ? 'Category' : 'Area'}
          </p>
          <p className="text-sm text-gray-500">
            Sunburst / Table view coming in Phase 3...
          </p>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <div className="w-12 h-12 mx-auto mb-4 text-gray-300">
            <StructureIcon />
          </div>
          <p>Select an area or category to view structure</p>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------
// Activities View
// --------------------------------------------

function ActivitiesView() {
  const nav = useNavigate();
  const { fullPathDisplay, isLeafCategory } = useFilter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const handleEditActivity = (sessionStart: string | null, categoryId: UUID, eventId: UUID) => {
    if (sessionStart) {
      // Normal case: navigate by session_start + categoryId
      const encodedSessionStart = encodeURIComponent(sessionStart);
      nav(`/app/edit/${encodedSessionStart}?categoryId=${categoryId}`);
    } else {
      // Fallback: activity has no session_start, navigate by single eventId
      nav(`/app/edit/${eventId}?noSession=1&categoryId=${categoryId}`);
    }
  };

  const handleViewDetails = (sessionStart: string | null, categoryId: UUID, eventId: UUID) => {
    if (sessionStart) {
      const encodedSessionStart = encodeURIComponent(sessionStart);
      nav(`/app/view/${encodedSessionStart}?categoryId=${categoryId}`);
    } else {
      nav(`/app/view/${eventId}?noSession=1&categoryId=${categoryId}`);
    }
  };

  // P1: Delete activity - briše events, attributes, storage fajlove
  const handleDeleteActivity = async (sessionStart: string): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Dohvati sve events za ovaj sessionStart
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id')
        .eq('session_start', sessionStart)
        .eq('user_id', user.id);

      if (eventsError) throw eventsError;
      if (!events || events.length === 0) return;

      const eventIds = (events as { id: string }[]).map(e => e.id);

      // Dohvati attachment URL-ove za brisanje iz storagea
      const { data: attachments } = await supabase
        .from('event_attachments')
        .select('url')
        .in('event_id', eventIds);

      // Briši fajlove iz Supabase storagea
      if (attachments && attachments.length > 0) {
        const paths = (attachments as { url: string }[])
          .map(a => {
            const parts = a.url.split('/activity-attachments/');
            return parts.length > 1 ? parts[1] : null;
          })
          .filter((p): p is string => p !== null);

        if (paths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('activity-attachments')
            .remove(paths);
          if (storageError) {
            console.error('Storage delete error (non-fatal):', storageError);
          }
        }
      }

      // Briši event_attachments iz DB
      await supabase.from('event_attachments').delete().in('event_id', eventIds);

      // Briši event_attributes iz DB
      await supabase.from('event_attributes').delete().in('event_id', eventIds);

      // Briši events iz DB
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .in('id', eventIds);

      if (deleteError) throw deleteError;

      // Osvježi tablicu
      setRefreshKey(prev => prev + 1);
      toast.success(`Aktivnost obrisana (${events.length} event${events.length !== 1 ? 's' : ''})`);

    } catch (err) {
      console.error('Delete activity failed:', err);
      toast.error('Brisanje nije uspjelo');
      throw err; // Propagate so ActivityRow može resetirati UI
    }
  };

  return (
    <div>
      {/* Current Path Info */}
      {fullPathDisplay && (
        <div className="mx-4 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <FolderIcon />
            <span className="text-blue-900 font-medium">{fullPathDisplay}</span>
            {isLeafCategory && (
              <span className="ml-auto text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded">
                ✓ Leaf
              </span>
            )}
          </div>
        </div>
      )}

      {/* Activities Table */}
      <ActivitiesTable 
        key={refreshKey}
        onEditActivity={handleEditActivity}
        onViewDetails={handleViewDetails}
        onDeleteActivity={handleDeleteActivity}
        onExport={() => setShowExport(true)}
        onImport={() => setShowImport(true)}
      />

      {/* Export Modal */}
      {showExport && (
        <ExcelExportModal onClose={() => setShowExport(false)} />
      )}

      {/* Import Modal */}
      {showImport && (
        <ExcelImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            setRefreshKey(prev => prev + 1);
            setShowImport(false);
            toast.success('Import completed – activities refreshed');
          }}
        />
      )}
    </div>
  );
}

// --------------------------------------------
// Main Export
// --------------------------------------------

export default function AppHome() {
  return <AppContent />;
}
