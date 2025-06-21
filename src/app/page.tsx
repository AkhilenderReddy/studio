"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { FileJson, Loader2, UploadCloud } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import * as pdfjs from 'pdfjs-dist';
import Image from 'next/image';

// This is required for pdf.js to work in Next.js
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
}

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { parseInvoice } from '@/ai/flows/parse-invoice';

const initialJson = {
  "order_number": null,
  "invoice_number": "",
  "order_date": null,
  "invoice_id": "",
  "invoice_date": "",
  "seller": { "name": "", "gst": "", "pan": "", "address": "", "state": "", "pincode": "", "country": null, "bank_details": { "account_name": "", "account_number": "", "bank_name": "", "branch": "", "ifsc": "" }, "contact_details": { "phone": null, "email": null } },
  "buyer": { "name": "", "gst": "", "pan": null, "address": "", "state": "", "pincode": "", "country": null, "contact_details": { "email": null, "phone": null }, "billing_address": "", "shipping_address": "" },
  "place_of_supply": "",
  "place_of_delivery": null,
  "invoice_items": [],
  "transaction_id": null,
  "date_time": null,
  "invoice_value": 0,
  "mode_of_payment": null
};

export default function Home() {
  const [invoiceImage, setInvoiceImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [jsonData, setJsonData] = useState<string>(JSON.stringify(initialJson, null, 2));
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('Awaiting invoice upload.');
  const [isDragging, setIsDragging] = useState(false);
  const [year, setYear] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  const convertPdfToImage = async (file: File) => {
    setStatus('Converting PDF to image...');
    const fileReader = new FileReader();
    fileReader.onload = async (event) => {
      if (event.target?.result) {
        try {
          const typedarray = new Uint8Array(event.target.result as ArrayBuffer);
          const pdf = await pdfjs.getDocument(typedarray).promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (context) {
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            setInvoiceImage(canvas.toDataURL('image/png'));
            setStatus('Ready to parse. Click the button below.');
          }
        } catch (error) {
          console.error('Error converting PDF:', error);
          toast({
            variant: "destructive",
            title: "PDF Conversion Failed",
            description: "Could not convert the selected PDF. Please ensure it's a valid file.",
          });
          setStatus('Failed to process PDF. Please try another file.');
          setInvoiceImage(null);
          setFileName(null);
        }
      }
    };
    fileReader.readAsArrayBuffer(file);
  };

  const handleFileSelect = useCallback((file: File | null) => {
    if (file && file.type === 'application/pdf') {
      setFileName(file.name);
      setInvoiceImage(null);
      setJsonData(JSON.stringify(initialJson, null, 2));
      convertPdfToImage(file);
    } else if (file) {
      toast({
        variant: "destructive",
        title: "Invalid File Type",
        description: "Please upload a PDF file.",
      });
    }
  }, [toast]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleParse = async () => {
    if (!invoiceImage) {
      toast({
        title: "No Invoice",
        description: "Please upload an invoice PDF first.",
      });
      return;
    }

    setIsLoading(true);
    setStatus('Extracting data with AI...');
    try {
      const result = await parseInvoice({ invoiceDataUri: invoiceImage });
      if (result.extractedData) {
        setJsonData(JSON.stringify(result.extractedData, null, 2));
        setStatus('Data extracted successfully. Simulating push to ERP...');
        toast({
          title: "Parsing Successful",
          description: "Invoice data has been extracted.",
        });

        setTimeout(() => {
          setStatus('Successfully pushed to ERP.');
          toast({
            title: "Push to ERP complete!",
            description: "The invoice data has been sent to the ERP system.",
          });
          setIsLoading(false);
        }, 1500);

      } else {
        throw new Error("No data was extracted from the invoice.");
      }
    } catch (error) {
      console.error('Parsing error:', error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setStatus(`Error: ${errorMessage}`);
      toast({
        variant: "destructive",
        title: "AI Parsing Failed",
        description: errorMessage,
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="py-4 border-b bg-card shadow-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center gap-4 px-4">
          <FileJson className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold font-headline text-gray-800">InvoiceAI</h1>
          <p className="text-muted-foreground hidden md:block">The future of invoice processing</p>
        </div>
      </header>

      <main className="flex-grow container mx-auto py-8 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="flex flex-col shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline">1. Upload Invoice</CardTitle>
              <CardDescription>Drag & drop a PDF invoice or browse your files.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              <div
                className={`flex-grow flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files ? e.target.files[0] : null)}
                />
                <UploadCloud className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="font-semibold font-headline">Drag & drop PDF here</p>
                <p className="text-sm text-muted-foreground">or click to browse</p>
              </div>
              
              {invoiceImage && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-2 font-headline">Invoice Preview: <span className="font-normal text-muted-foreground">{fileName}</span></h3>
                  <div className="border rounded-lg p-2 bg-muted/50 overflow-hidden shadow-inner">
                    <Image 
                      src={invoiceImage} 
                      alt="Invoice Preview"
                      width={500}
                      height={707}
                      className="rounded-md object-contain max-h-[400px] w-full"
                      data-ai-hint="invoice document"
                      />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flex flex-col shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline">2. Review Extracted Data</CardTitle>
              <CardDescription>The extracted JSON will appear here. Review and edit it before pushing to ERP.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              <Textarea
                value={jsonData}
                onChange={(e) => setJsonData(e.target.value)}
                className="flex-grow w-full h-full min-h-[400px] font-mono text-xs bg-gray-50"
                placeholder="JSON data will appear here..."
              />
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <Button 
            onClick={handleParse} 
            disabled={isLoading || !invoiceImage}
            size="lg"
            className="w-full max-w-md bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base shadow-lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : 'Parse Invoice & Push to ERP'}
          </Button>
          <div className="text-center text-sm text-muted-foreground h-5">
            {status}
          </div>
        </div>
      </main>

      <footer className="py-4 border-t bg-card">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>&copy; {year} InvoiceAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
