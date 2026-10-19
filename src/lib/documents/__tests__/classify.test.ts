import { describe, it, expect } from 'vitest';
import { classifyDocument, formatBadge, isJunkFile, fileExtension } from '../classify';

describe('classifyDocument', () => {
    it('classifies LAS and curve/tool-named rasters as geophysical logs', () => {
        expect(classifyDocument('0503306123_WELLLOG.LAS')).toBe('Geophysical logs');
        expect(classifyDocument('0508306628_TRIPLE_COMBO NPHI.tif')).toBe('Geophysical logs');
        expect(classifyDocument('0503306097_INDUCTION.tif')).toBe('Geophysical logs');
        // "GAMA" misspelling in the real data still lands as a log
        expect(classifyDocument('0503306097_CORE_GAMA_RAY.tif')).toBe('Geophysical logs');
    });

    it('catches the log names that used to be mislabeled as core photos', () => {
        // widened LOG matching — these are all image-extension logs from the real data
        expect(classifyDocument('MUD_LOG.jpg')).toBe('Geophysical logs');
        expect(classifyDocument('Triple Print Combo.tif')).toBe('Geophysical logs');
        expect(classifyDocument('WHITING_GR Spectralog 1100_4845.TIF')).toBe('Geophysical logs');
        expect(classifyDocument('Logs_Image Files_ABC_CBL_Page_1.tif')).toBe('Geophysical logs');
        expect(classifyDocument('Geophysical Surveys_PORO.tif')).toBe('Geophysical logs');
        expect(classifyDocument('Whiting_Cement Bond 75_1166.TIF')).toBe('Geophysical logs');
        // a bare "log" token (separator-bounded) counts too
        expect(classifyDocument('08-18-1_wellsite_log.pdf')).toBe('Geophysical logs');
    });

    it('does not fire the log token inside ordinary words', () => {
        // "catalog"/"geology" contain "log" but are not logs
        expect(classifyDocument('catalog_index.csv')).toBe('Data & spreadsheets');
        expect(classifyDocument('Regional Geology overview.pdf')).toBe('Reports & completion');
    });

    it('classifies ICP/TOC as geochemistry, even as a spreadsheet', () => {
        expect(classifyDocument('PR-15-7c ICP and TOC summary.xlsx')).toBe('Geochemistry & analyses');
    });

    it('keeps core-analysis spreadsheets in geochemistry despite the poro/density log stems', () => {
        expect(classifyDocument('Bulk Density analyses.xlsx')).toBe('Geochemistry & analyses');
        expect(classifyDocument('Routine Core Analysis porosity permeability.xlsx')).toBe('Geochemistry & analyses');
    });

    it('classifies completion/coregraph and keyword-free PDFs as reports', () => {
        expect(classifyDocument('Rector 8X Completion Coregraph(1.0).pdf')).toBe('Reports & completion');
        expect(classifyDocument('Federal Rabbit Creek narrative.pdf')).toBe('Reports & completion');
    });

    it('classifies photo-named files as core photos, keyword beating the extension bucket', () => {
        expect(classifyDocument('Carbon_Canal_5-12_Core_Photo_overview_8805.0-8810.0.jpg')).toBe('Core photos');
        // the .pdf extension no longer wins over the photo keyword
        expect(classifyDocument('BARRETT_Sidewall Core Photos.pdf')).toBe('Core photos');
        // trailing-word "Photos"/"Photo" (no "core" adjacent) also counts
        expect(classifyDocument('BARRETT Sidewall Photos.pdf')).toBe('Core photos');
        expect(classifyDocument('Box 3 Photo.jpg')).toBe('Core photos');
    });

    it('sends keyword-free image files to Images & scans (not Core photos)', () => {
        expect(classifyDocument('Thin Section_Ute Tribal 9-4 B1_11009ft_200xPL.JPG')).toBe('Images & scans');
        expect(classifyDocument('CORE DIAGRAM.jpg')).toBe('Images & scans');
        expect(classifyDocument('scan_0001.tif')).toBe('Images & scans');
    });

    it('classifies plain spreadsheets/csv as data', () => {
        expect(classifyDocument('_AlderanDH_Results.xlsx')).toBe('Data & spreadsheets');
        expect(classifyDocument('samples.csv')).toBe('Data & spreadsheets');
    });

    it('falls back to Other for unknown/extensionless files', () => {
        expect(classifyDocument('mystery.dat')).toBe('Other');
        expect(classifyDocument('noext')).toBe('Other');
    });
});

describe('isJunkFile', () => {
    it('is true for Windows/GIS sidecar files', () => {
        expect(isJunkFile('STIRRUP STATE CORE PHOTOS_Thumbs.db')).toBe(true);
        expect(isJunkFile('Logs_Federal Rabbit Creek#1.prj')).toBe(true);
        expect(isJunkFile('Thin Section_magnetic.gxf.ovr')).toBe(true);
        expect(isJunkFile('Thin Section_magnetic.gxf.aux.xml')).toBe(true);
        expect(isJunkFile('Geophysical_DSL.meta')).toBe(true);
    });
    it('is false for real documents, including real xml/ini that are no longer blanket-hidden', () => {
        expect(isJunkFile('MUD_LOG.jpg')).toBe(false);
        expect(isJunkFile('report.pdf')).toBe(false);
        expect(isJunkFile('0503306123_WELLLOG.LAS')).toBe(false);
        expect(isJunkFile('well_metadata.xml')).toBe(false);
        expect(isJunkFile('tool_config.ini')).toBe(false);
    });
});

describe('formatBadge', () => {
    it('maps extensions to short uppercase badges', () => {
        expect(formatBadge('a.pdf')).toBe('PDF');
        expect(formatBadge('a.LAS')).toBe('LAS');
        expect(formatBadge('a.xlsx')).toBe('XLSX');
        expect(formatBadge('a.jpeg')).toBe('JPG');
        expect(formatBadge('a.tiff')).toBe('TIF');
        expect(formatBadge('noext')).toBe('FILE');
    });
});

describe('fileExtension', () => {
    it('lowercases and drops the dot; empty when none', () => {
        expect(fileExtension('A.PDF')).toBe('pdf');
        expect(fileExtension('a.b.csv')).toBe('csv');
        expect(fileExtension('noext')).toBe('');
    });
});
