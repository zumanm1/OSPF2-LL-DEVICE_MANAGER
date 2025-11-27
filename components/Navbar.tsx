import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import NetworkIcon from './icons/NetworkIcon';
import SunIcon from './icons/SunIcon';
import MoonIcon from './icons/MoonIcon';
import SaveIcon from './icons/SaveIcon';
import ImportIcon from './icons/ImportIcon';

interface NavbarProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onSaveState: () => void;
  onLoadStateClick: () => void;
  currentUser?: string | null;
  onLogout?: () => void;
}

const NavLink: React.FC<{
  to: string;
  children: React.ReactNode;
  isActive?: boolean;
}> = ({ to, children, isActive }) => (
  <Link
    to={to}
    className={`relative px-4 py-2 text-sm font-medium transition-colors ${isActive
      ? 'text-primary-600 dark:text-primary-400'
      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
      }`}
  >
    {children}
    {isActive && (
      <motion.div
        layoutId="navbar-indicator"
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full"
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    )}
  </Link>
);

const Navbar: React.FC<NavbarProps> = ({
  theme,
  toggleTheme,
  onSaveState,
  onLoadStateClick,
  currentUser,
  onLogout
}) => {
  const location = useLocation();

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="glass sticky top-0 z-40 border-b border-white/20 dark:border-white/10"
    >
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex-shrink-0 flex items-center gap-3 group cursor-pointer">
              <div className="relative">
                <div className="absolute inset-0 bg-primary-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity rounded-full"></div>
                <NetworkIcon className="relative h-8 w-8 text-primary-600 dark:text-primary-400 transition-transform group-hover:scale-110 duration-300" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-purple-600 dark:from-primary-400 dark:to-purple-400">
                NetMan
              </span>
            </Link>
            <div className="hidden md:block">
              <div className="flex items-baseline space-x-2">
                <NavLink to="/" isActive={location.pathname === '/'}>
                  Device Manager
                </NavLink>
                <NavLink to="/automation" isActive={location.pathname === '/automation'}>
                  Automation
                </NavLink>
                <NavLink to="/data-save" isActive={location.pathname === '/data-save'}>
                  Data Save
                </NavLink>
                <NavLink to="/interface-costs" isActive={location.pathname === '/interface-costs'}>
                  Interface Costs
                </NavLink>
                <NavLink to="/ospf-designer" isActive={location.pathname === '/ospf-designer'}>
                  OSPF Designer
                </NavLink>
                <NavLink to="/transformation" isActive={location.pathname === '/transformation'}>
                  Transformation
                </NavLink>
                <NavLink to="/interface-traffic" isActive={location.pathname === '/interface-traffic'}>
                  Traffic Analysis
                </NavLink>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSaveState}
              className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors"
              title="Save Configuration"
            >
              <SaveIcon className="w-5 h-5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onLoadStateClick}
              className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors"
              title="Load Configuration"
            >
              <ImportIcon className="w-5 h-5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors"
              title="Toggle Theme"
            >
              {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
            </motion.button>

            {/* User Info and Logout */}
            {currentUser && (
              <div className="flex items-center gap-3 ml-3 pl-3 border-l border-gray-300 dark:border-gray-600">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="text-gray-400 dark:text-gray-500">👤</span> {currentUser}
                </span>
                {onLogout && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onLogout}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100/50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="Logout"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </motion.button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
