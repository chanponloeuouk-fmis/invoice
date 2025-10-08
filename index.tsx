import React, { useState, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type } from "@google/genai";

// --- TYPES ---
interface Customer {
  id: string;
  name: string;
  email: string;
  address: string;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

type DocumentType = "Invoice" | "Quotation";

interface Document {
  id: string;
  customerId: string;
  type: DocumentType;
  date: string;
  lineItems: LineItem[];
}

// --- API SETUP ---
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- HOOKS for Local Storage ---
function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

// --- COMPONENTS ---

const Header: React.FC<{ activeView: string; setActiveView: (view: string) => void }> = ({ activeView, setActiveView }) => (
  <header className="header">
    <nav>
      <a href="#" className="logo" onClick={() => setActiveView("dashboard")}>
        GenDocs
      </a>
      <button className={`nav-link ${activeView === "dashboard" ? "active" : ""}`} onClick={() => setActiveView("dashboard")}>Dashboard</button>
      <button className={`nav-link ${activeView === "customers" ? "active" : ""}`} onClick={() => setActiveView("customers")}>Customers</button>
      <button className={`nav-link ${activeView === "creator" ? "active" : ""}`} onClick={() => setActiveView("creator")}>New Document</button>
    </nav>
  </header>
);

const Dashboard: React.FC<{ documents: Document[]; customers: Customer[]; setActiveView: (view: string) => void }> = ({ documents, customers, setActiveView }) => {
  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || "Unknown";
  const calculateTotal = (lineItems: LineItem[]) => lineItems.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);

  const invoices = documents.filter(d => d.type === 'Invoice');
  const quotations = documents.filter(d => d.type === 'Quotation');

  return (
    <div>
      <div className="card">
        <h2>Dashboard</h2>
        <p>Welcome! Here's an overview of your documents.</p>
        {documents.length === 0 && (
           <div className="empty-state">
              <h3>No documents yet</h3>
              <p>Create your first invoice or quotation to get started.</p>
              <button className="btn btn-primary" onClick={() => setActiveView('creator')}>Create Document</button>
           </div>
        )}
      </div>

      {documents.length > 0 && (
         <>
         <div className="card">
            <h3>Invoices</h3>
            {invoices.length > 0 ? (
                <div className="grid">
                    {invoices.map(doc => (
                        <div key={doc.id} className="document-card">
                            <p><strong>To:</strong> {getCustomerName(doc.customerId)}</p>
                            <p><strong>Total:</strong> ${calculateTotal(doc.lineItems).toFixed(2)}</p>
                            <p><strong>Date:</strong> {new Date(doc.date).toLocaleDateString()}</p>
                        </div>
                    ))}
                </div>
            ) : <p>No invoices found.</p>}
         </div>
         <div className="card">
            <h3>Quotations</h3>
            {quotations.length > 0 ? (
                <div className="grid">
                    {quotations.map(doc => (
                        <div key={doc.id} className="document-card">
                            <p><strong>To:</strong> {getCustomerName(doc.customerId)}</p>
                            <p><strong>Total:</strong> ${calculateTotal(doc.lineItems).toFixed(2)}</p>
                            <p><strong>Date:</strong> {new Date(doc.date).toLocaleDateString()}</p>
                        </div>
                    ))}
                </div>
            ) : <p>No quotations found.</p>}
         </div>
         </>
      )}
    </div>
  );
};

const CustomerManager: React.FC<{ customers: Customer[]; setCustomers: React.Dispatch<React.SetStateAction<Customer[]>> }> = ({ customers, setCustomers }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!name || !email) return;
        const newCustomer: Customer = { id: Date.now().toString(), name, email, address };
        setCustomers(prev => [...prev, newCustomer]);
        setName(''); setEmail(''); setAddress('');
    };

    return (
        <div>
            <div className="card">
                <h2>Add New Customer</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group"><label>Name</label><input type="text" className="form-control" value={name} onChange={e => setName(e.target.value)} required /></div>
                    <div className="form-group"><label>Email</label><input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                    <div className="form-group"><label>Address</label><textarea className="form-control" value={address} onChange={e => setAddress(e.target.value)}></textarea></div>
                    <button type="submit" className="btn btn-primary">Add Customer</button>
                </form>
            </div>
            <div className="card">
                <h2>Your Customers</h2>
                {customers.length > 0 ? (
                    <div className="grid">
                        {customers.map(c => <div key={c.id} className="customer-card">
                            <p><strong>{c.name}</strong></p>
                            <p>{c.email}</p>
                            <p>{c.address}</p>
                        </div>)}
                    </div>
                ) : <p>No customers yet. Add one above to get started!</p>}
            </div>
        </div>
    );
};

const DocumentCreator: React.FC<{ customers: Customer[]; setDocuments: React.Dispatch<React.SetStateAction<Document[]>>; setActiveView: (view: string) => void }> = ({ customers, setDocuments, setActiveView }) => {
    const [type, setType] = useState<DocumentType>('Invoice');
    const [customerId, setCustomerId] = useState<string>('');
    const [lineItems, setLineItems] = useState<LineItem[]>([]);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if(customers.length > 0 && !customerId) {
            setCustomerId(customers[0].id);
        }
    }, [customers, customerId]);
    
    const handleGenerateWithAI = async () => {
        if (!aiPrompt) return;
        setIsLoading(true);
        try {
            const schema = {
              type: Type.OBJECT,
              properties: {
                lineItems: {
                  type: Type.ARRAY,
                  description: "A list of line items for the document.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      description: { type: Type.STRING, description: "Detailed description of the service or product." },
                      quantity: { type: Type.NUMBER, description: "The quantity or number of hours." },
                      unitPrice: { type: Type.NUMBER, description: "The price per unit or per hour." },
                    },
                    required: ['description', 'quantity', 'unitPrice']
                  }
                }
              },
              required: ['lineItems'],
            };

            const fullPrompt = `Generate a list of line items for a ${type} based on the following request: "${aiPrompt}". Provide realistic quantities and prices.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: fullPrompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema,
                },
            });

            const result = JSON.parse(response.text);
            if(result.lineItems) {
                setLineItems(result.lineItems.map((item: Omit<LineItem, 'id'>) => ({...item, id: Date.now().toString() + Math.random()})));
            }
        } catch (error) {
            console.error("Error generating content with AI:", error);
            alert("Sorry, there was an error generating the items. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const addLineItem = () => setLineItems(prev => [...prev, {id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0}]);
    const removeLineItem = (id: string) => setLineItems(prev => prev.filter(item => item.id !== id));
    const updateLineItem = (id: string, field: keyof Omit<LineItem, 'id'>, value: string | number) => {
        setLineItems(prev => prev.map(item => item.id === id ? {...item, [field]: value} : item));
    };

    const total = useMemo(() => lineItems.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0), [lineItems]);
    
    const saveDocument = () => {
        if (!customerId || lineItems.length === 0) {
            alert("Please select a customer and add at least one line item.");
            return;
        }
        const newDoc: Document = {
            id: Date.now().toString(),
            customerId,
            type,
            date: new Date().toISOString(),
            lineItems
        };
        setDocuments(prev => [...prev, newDoc]);
        setActiveView('dashboard');
    };

    return (
        <div className="card" style={{position: 'relative'}}>
            <h2>Create New {type}</h2>
            
            <div className="form-group">
                <label>Document Type</label>
                <select className="form-control" value={type} onChange={e => setType(e.target.value as DocumentType)}>
                    <option value="Invoice">Invoice</option>
                    <option value="Quotation">Quotation</option>
                </select>
            </div>

            <div className="form-group">
                <label>Customer</label>
                {customers.length > 0 ? (
                    <select className="form-control" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                ) : <p>Please add a customer first in the 'Customers' tab.</p>}
            </div>

            <div className="ai-prompt-section">
                <h3>✨ Generate Items with AI</h3>
                <p>Describe what this {type} is for, and let AI create the line items for you.</p>
                <div className="form-group">
                    <textarea 
                        className="form-control"
                        placeholder="e.g., A quotation for a new company website with design, development, and one year of hosting."
                        value={aiPrompt}
                        onChange={e => setAiPrompt(e.target.value)}
                    ></textarea>
                </div>
                <button className="btn btn-primary" onClick={handleGenerateWithAI} disabled={isLoading || !aiPrompt}>
                    {isLoading ? <span className="spinner"></span> : 'Generate Items'}
                </button>
            </div>
            
            <h3>Line Items</h3>
            <table className="line-items-table">
                <thead>
                    <tr><th>Description</th><th>Quantity</th><th>Unit Price</th><th>Total</th><th className="actions"></th></tr>
                </thead>
                <tbody>
                    {lineItems.map(item => (
                        <tr key={item.id}>
                            <td><input type="text" value={item.description} onChange={e => updateLineItem(item.id, 'description', e.target.value)} /></td>
                            <td><input type="number" value={item.quantity} onChange={e => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} /></td>
                            <td><input type="number" value={item.unitPrice} onChange={e => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} /></td>
                            <td>${(item.quantity * item.unitPrice).toFixed(2)}</td>
                            <td><button className="btn btn-danger" onClick={() => removeLineItem(item.id)}>X</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <button className="btn btn-secondary" style={{marginTop: '1rem'}} onClick={addLineItem}>+ Add Item</button>

            <div className="total-summary">
                <div className="total-summary-card">
                    <p>Total: ${total.toFixed(2)}</p>
                </div>
            </div>

            <div style={{marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem'}}>
                <button className="btn btn-primary" onClick={saveDocument}>Save {type}</button>
            </div>
            {isLoading && <div className="loading-overlay"><div className="spinner-dark"></div></div>}
        </div>
    );
};


const App: React.FC = () => {
  const [activeView, setActiveView] = useState("dashboard");
  const [customers, setCustomers] = useLocalStorage<Customer[]>("gendocs_customers", []);
  const [documents, setDocuments] = useLocalStorage<Document[]>("gendocs_documents", []);

  const renderView = () => {
    switch (activeView) {
      case "dashboard":
        return <Dashboard documents={documents} customers={customers} setActiveView={setActiveView} />;
      case "customers":
        return <CustomerManager customers={customers} setCustomers={setCustomers} />;
      case "creator":
        return <DocumentCreator customers={customers} setDocuments={setDocuments} setActiveView={setActiveView} />;
      default:
        return <Dashboard documents={documents} customers={customers} setActiveView={setActiveView} />;
    }
  };

  return (
    <>
      <div className="app-container">
        <Header activeView={activeView} setActiveView={setActiveView} />
        <main>{renderView()}</main>
      </div>
    </>
  );
};

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
