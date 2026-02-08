import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { FilterProvider, useFilter } from '@/context/FilterContext';
import { ProgressiveCategorySelector } from '@/components/filter/ProgressiveCategorySelector';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { Category } from '@/types/database';

// --------------------------------------------
// Icons
// --------------------------------------------

const LogoutIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);

const StructureIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
    />
  </svg>
);

const ActivitiesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
);

const AddIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4v16m8-8H4"
    />
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
  const [email, setEmail] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('activities');
  const { filter, hasActiveFilter, reset } = useFilter();

  // Get user email
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const e = data.session?.user.email;
      setEmail(e ?? '');
    });
  }, []);

  // Sign out handler
  const onSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
    else {
      toast.success('Signed out');
      nav('/login');
    }
  };

  // Handle leaf category selection
  const handleLeafSelected = (_category: Category, path: Category[]) => {
    toast.success(
      `âœ" Category selected: ${path.map((c) => c.name).join(' > ')}`
    );
  };

  // Check if Add Activity should be enabled (only when leaf category is selected)
  const canAddActivity = Boolean(filter.categoryId);

  // Check screen size for responsive layout
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo / Title */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">ET</span>
              </div>
              <h1 className="font-semibold text-gray-900 hidden sm:block">
                Events Tracker
              </h1>
            </div>

            {/* User section */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 hidden sm:block">
                {email}
              </span>
              <IconButton
                icon={<LogoutIcon />}
                variant="ghost"
                onClick={onSignOut}
                aria-label="Sign out"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex bg-white rounded-lg p-1 shadow-sm">
            <TabButton
              active={activeTab === 'activities'}
              onClick={() => setActiveTab('activities')}
              icon={<ActivitiesIcon />}
              label="Activities"
            />
            <TabButton
              active={activeTab === 'structure'}
              onClick={() => setActiveTab('structure')}
              icon={<StructureIcon />}
              label="Structure"
            />
          </div>

          <div className="flex-1" />

          {/* Add Activity Button */}
          <Button
            leftIcon={<AddIcon />}
            onClick={() => nav('/app/add')}
            disabled={!canAddActivity}
          >
            {!isMobile && 'Add Activity'}
          </Button>
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Filter Panel */}
          <Card className="lg:col-span-1" padding="none">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Filter</h2>
                {hasActiveFilter && (
                  <button
                    onClick={reset}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
            <div className="p-4">
              <ProgressiveCategorySelector
                onLeafSelected={handleLeafSelected}
              />
            </div>
          </Card>

          {/* Content Panel */}
          <Card className="lg:col-span-2" padding="none">
            {activeTab === 'structure' ? (
              <StructureView />
            ) : (
              <ActivitiesView />
            )}
          </Card>
        </div>
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
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
        active
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// --------------------------------------------
// Structure View (placeholder)
// --------------------------------------------

function StructureView() {
  const { filter } = useFilter();

  return (
    <div className="p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Structure View</h3>

      {filter.areaId || filter.categoryId ? (
        <div className="space-y-4">
          <p className="text-gray-600">
            Selected: {filter.categoryId ? 'Category' : 'Area'}
          </p>
          <p className="text-sm text-gray-500">
            Details panel will show here...
          </p>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <div className="w-12 h-12 mx-auto mb-4 text-gray-300">
            <StructureIcon />
          </div>
          <p className="mt-2">Select an area or category to view details</p>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------
// Activities View (placeholder)
// --------------------------------------------

function ActivitiesView() {
  const { filter } = useFilter();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-gray-900">Activities</h3>

        {/* Date range picker placeholder */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Date range:</span>
          <button className="px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200">
            Start → End
          </button>
        </div>
      </div>

      {/* Success message when category is selected */}
      {filter.categoryId && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            âœ" Category selected - Activities table will be shown here
          </p>
        </div>
      )}

      {/* Coming in next phase notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h4 className="font-medium text-blue-900 mb-2">Coming in next phase:</h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Activities table with Date, Time, Category Path, Comment</li>
          <li>Load more pagination</li>
          <li>Quick edit/delete actions</li>
          <li>Export to Excel</li>
        </ul>
      </div>

      {/* Placeholder content */}
      <div className="text-center py-12 text-gray-500">
        <div className="w-12 h-12 mx-auto mb-4 text-gray-300">
          <ActivitiesIcon />
        </div>
        <p className="mt-2">
          {filter.categoryId
            ? 'Activities table coming in Phase 2...'
            : 'Select a category to view activities'}
        </p>
      </div>
    </div>
  );
}

// --------------------------------------------
// Main Export (wrapped in FilterProvider)
// --------------------------------------------

export default function AppHome() {
  return (
    <FilterProvider>
      <AppContent />
    </FilterProvider>
  );
}
