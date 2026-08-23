# Assessment Workbook

Place the supplied source workbook in this directory:

```
ParcelPilot_Assessment_Data.xlsx
```

This directory must contain the original, unmodified source file.

The inspection, validation and ingestion scripts read from this location by
default:

```
python scripts/inspect_assessment_workbook.py
python scripts/validate_assessment_data.py
python scripts/ingest_assessment_workbook.py
```

Do not rename, edit, or duplicate the source workbook.