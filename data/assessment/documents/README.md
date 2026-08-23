# Assessment Documents

Place the six supplied source PDFs in this directory:

```
01_Support_Policy_v3_CURRENT.pdf
02_Support_Policy_v2_DEPRECATED.pdf
03_Cancellation_and_Service_Credit_SOP_v4.pdf
04_Product_Operations_Guide_and_Known_Issues.pdf
05_Northstar_Logistics_Enterprise_Agreement.pdf
06_LumenWorks_Service_Agreement.pdf
```

These files are the authoritative source documents for the ParcelPilot
assessment. They are ingested through the existing document processing
pipeline (BullMQ → extraction → chunking → embedding → pgvector).

Do not rename, edit, or duplicate the supplied PDFs.