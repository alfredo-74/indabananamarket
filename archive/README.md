# Archive Directory

This directory contains deprecated, backup, and legacy files that are no longer actively used in the production codebase but are preserved for reference.

## Directory Structure

### `backup_files/`
Backup files created during development and refactoring:
- `f1-command-center.tsx.backup` - Old F1 Command Center UI backup (Nov 2025)
- `ibkr_connector.py_1761414198397.backup` - Old IBKR connector backup (Oct 2025)
- `regime_system.py_1761414198397.backup` - Old regime system backup (Oct 2025)

### `old_routes/`
Legacy routing implementations replaced by `routes_stable.ts`:
- `routes.ts` - Original routing file
- `routes_clean.ts` - Cleaned routing implementation

### `old_components/`
Deprecated UI components (placeholder for future deprecated components)

### `old_scripts/`
Deprecated scripts and utilities (placeholder for future deprecated scripts)

## Migration to GitHub

**Important**: When pushing to GitHub, the `.gitignore` file ensures that:
- Secrets and credentials are NOT pushed
- Environment variables are protected
- IBKR trading credentials remain secure
- Only source code and documentation are committed

## Restoration

If you need to restore any archived file:
1. Copy the file from the archive directory
2. Update any dependencies or imports
3. Test thoroughly before deployment
4. Update this README with restoration notes

---
*Last Updated: November 11, 2025*
