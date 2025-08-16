import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AutomationPage } from '../automation-page';

// Mock the child components
jest.mock('../automation-dashboard', () => ({
  AutomationDashboard: () => (
    <div data-testid="automation-dashboard">Mocked AutomationDashboard</div>
  ),
}));

jest.mock('../log-display', () => ({
  LogDisplay: () => <div data-testid="log-display">Mocked LogDisplay</div>,
}));

// Mock fetch to prevent API calls from child components
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
});

describe('AutomationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the main page structure', () => {
    render(<AutomationPage />);

    // Check main heading
    expect(
      screen.getByText('LinkedIn Connection Automation')
    ).toBeInTheDocument();

    // Check subtitle
    expect(
      screen.getByText(
        'Automate LinkedIn connections based on mutual connection thresholds'
      )
    ).toBeInTheDocument();
  });

  it('should render both dashboard and log display components', () => {
    render(<AutomationPage />);

    expect(screen.getByTestId('automation-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('log-display')).toBeInTheDocument();
  });

  it('should render the "How It Works" section', () => {
    render(<AutomationPage />);

    expect(screen.getByText('How It Works')).toBeInTheDocument();

    // Check the three steps
    expect(screen.getByText('1. Login')).toBeInTheDocument();
    expect(screen.getByText('2. Navigate')).toBeInTheDocument();
    expect(screen.getByText('3. Connect')).toBeInTheDocument();
  });

  it('should display step descriptions', () => {
    render(<AutomationPage />);

    expect(
      screen.getByText(
        'Automatically logs into LinkedIn using your credentials'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Navigates to the network growth section and opens connection modal'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Connects with people who meet your mutual connection criteria'
      )
    ).toBeInTheDocument();
  });

  it('should have proper layout structure', () => {
    render(<AutomationPage />);

    // Check for main container
    const mainContainer = screen
      .getByText('LinkedIn Connection Automation')
      .closest('.min-h-screen');
    expect(mainContainer).toBeInTheDocument();
    expect(mainContainer).toHaveClass('bg-gray-100', 'py-8');

    // Check for grid layout
    const gridContainer = screen
      .getByTestId('automation-dashboard')
      .closest('.grid');
    expect(gridContainer).toBeInTheDocument();
    expect(gridContainer).toHaveClass('grid-cols-1', 'xl:grid-cols-2', 'gap-8');
  });

  it('should render step icons', () => {
    render(<AutomationPage />);

    // Check for SVG icons (they should be present in the DOM)
    const svgElements = screen.getAllByRole('img', { hidden: true });
    expect(svgElements.length).toBeGreaterThan(0);
  });

  it('should have responsive design classes', () => {
    render(<AutomationPage />);

    // Check for responsive container
    const container = screen
      .getByText('LinkedIn Connection Automation')
      .closest('.max-w-7xl');
    expect(container).toBeInTheDocument();
    expect(container).toHaveClass('mx-auto', 'px-4', 'sm:px-6', 'lg:px-8');
  });

  it('should render information cards with proper styling', () => {
    render(<AutomationPage />);

    // Check for step cards
    const loginCard = screen.getByText('1. Login').closest('.text-center');
    expect(loginCard).toBeInTheDocument();

    const navigateCard = screen
      .getByText('2. Navigate')
      .closest('.text-center');
    expect(navigateCard).toBeInTheDocument();

    const connectCard = screen.getByText('3. Connect').closest('.text-center');
    expect(connectCard).toBeInTheDocument();
  });

  it('should have proper semantic structure', () => {
    render(<AutomationPage />);

    // Check for proper heading hierarchy
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('LinkedIn Connection Automation');

    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2).toHaveTextContent('How It Works');

    const h3Elements = screen.getAllByRole('heading', { level: 3 });
    expect(h3Elements).toHaveLength(3);
    expect(h3Elements[0]).toHaveTextContent('1. Login');
    expect(h3Elements[1]).toHaveTextContent('2. Navigate');
    expect(h3Elements[2]).toHaveTextContent('3. Connect');
  });
});
