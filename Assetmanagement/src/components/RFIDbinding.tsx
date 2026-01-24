import { useState, useEffect } from 'react';
import './RFIDbinding.css';
import { getGRNList, bindRFID, getAssetList, getAssetTaggingList } from '../api/endpoint';

interface GRN {
  grnId: number;
  grnNumber: string;
  vendorName?: string;
  lineItems?: LineItem[];
}

interface LineItem {
  assetId?: number;
  assetName: string;
  quantity: number;
  rfidTrackable: boolean;
  category?: string;
  categoryId?: number;
  price?: number;
  unitOfMeasure?: string;
}

interface RFIDBinding {
  assetTaggingId: number;
  assetId: number;
  assetName: string;
  serialNo: string;
  rfidNo: string;
  qrCode: string;
  status: number;
  assetStatus: string;
  uniqueKey: string;
}

function RFIDbinding() {
  const [grns, setGrns] = useState<GRN[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<LineItem | null>(null);
  const [bindings, setBindings] = useState<RFIDBinding[]>([
    {
      assetTaggingId: 0,
      assetId: 0,
      assetName: '',
      serialNo: '',
      rfidNo: '',
      qrCode: '',
      status: 0,
      assetStatus: 'Active',
      uniqueKey: `binding-${Date.now()}-0`,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [totalQty, setTotalQty] = useState(0);
  const [boundQty, setBoundQty] = useState(0);
  const [remainingQty, setRemainingQty] = useState(0);
  const [currentBindingIndex, setCurrentBindingIndex] = useState(0);
  const [assetMapping, setAssetMapping] = useState<Map<string, number>>(new Map());
  const [boundAssetsList, setBoundAssetsList] = useState<any[]>([]);

  // Function to encrypt serial number for QR code
  const encryptSerialNo = (serialNo: string): string => {
    if (!serialNo) return '';
    // Base64 encoding with some additional transformation
    const encoded = btoa(serialNo);
    // Reverse and add prefix for additional obfuscation
    return `QR-${encoded.split('').reverse().join('')}`;
  };

  // Function to decrypt QR code back to serial number (for verification)
  const decryptQrCode = (qrCode: string): string => {
    if (!qrCode || !qrCode.startsWith('QR-')) return '';
    try {
      // Remove prefix and reverse
      const encoded = qrCode.substring(3).split('').reverse().join('');
      // Decode from base64
      const decoded = atob(encoded);
      return decoded;
    } catch (error) {
      console.error('Failed to decrypt QR code:', error);
      return '';
    }
  };

  useEffect(() => {
    fetchGRNs();
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const response = await getAssetList();
      console.log('Asset API Response:', response);
      let data = [];
      if (Array.isArray(response)) {
        data = response;
      } else if (response.data && Array.isArray(response.data)) {
        data = response.data;
      }
      
      // Create mapping of assetName to assetId
      const mapping = new Map<string, number>();
      data.forEach((asset: any) => {
        if (asset.assetName && asset.assetId) {
          mapping.set(asset.assetName, asset.assetId);
        }
      });
      console.log('Asset Name to ID Mapping:', Array.from(mapping.entries()));
      setAssetMapping(mapping);
    } catch (err: any) {
      console.error('Failed to fetch assets:', err);
    }
  };

  const fetchGRNs = async () => {
    setLoading(true);
    try {
      const response = await getGRNList();
      console.log('GRN API Response:', response);
      let data = [];
      if (Array.isArray(response)) {
        data = response;
      } else if (response.data && Array.isArray(response.data)) {
        data = response.data;
      }
      console.log('Processed GRN Data:', data);
      // Show all GRNs for now
      setGrns(data);
    } catch (err: any) {
      console.error('Failed to fetch GRNs:', err);
      setError('Failed to fetch GRNs');
    } finally {
      setLoading(false);
    }
  };

  const handleAssetSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    console.log('Raw selected value:', value, 'Type:', typeof value);
    
    if (!value || value === '') {
      console.log('No asset selected, resetting...');
      setSelectedAsset(null);
      setTotalQty(0);
      setBoundQty(0);
      setRemainingQty(0);
      setCurrentBindingIndex(0);
      setBoundAssetsList([]);
      setBindings([
        {
          assetTaggingId: 0,
          assetId: 0,
          assetName: '',
          serialNo: '',
          rfidNo: '',
          qrCode: '',
          status: 0,
          assetStatus: 'Active',
          uniqueKey: `binding-${Date.now()}-0`,
        },
      ]);
      return;
    }
    
    console.log('Selected Asset Name:', value);
    
    // Find all matching assets across all GRNs and sum quantities
    let totalQuantity = 0;
    let foundAsset: LineItem | null = null;
    
    grns.forEach((grn) => {
      grn.lineItems?.forEach((item: LineItem) => {
        if (item.assetName === value) {
          totalQuantity += item.quantity;
          if (!foundAsset) {
            foundAsset = item as LineItem;
          }
        }
      });
    });
    
    console.log('Total quantity across all GRNs:', totalQuantity);
    setSelectedAsset(foundAsset);
    
    if (foundAsset && totalQuantity > 0) {
      const asset = foundAsset as LineItem;
      console.log('Found Asset with assetId:', asset.assetId);
      // Fetch already bound assets
      fetchBoundAssets(asset.assetName, totalQuantity);
    } else {
      console.log('Asset not found in line items!');
    }
  };

  const fetchBoundAssets = async (assetName: string, totalQuantity: number) => {
    try {
      const response = await getAssetTaggingList();
      console.log('Asset Tagging List Response:', response);
      
      let data = [];
      if (Array.isArray(response)) {
        data = response;
      } else if (response.data && Array.isArray(response.data)) {
        data = response.data;
      }
      
      // Filter by selected asset name and status = 1 (completed)
      const boundForAsset = data.filter((item: any) => 
        item.assetName === assetName && item.status === 1
      );
      
      console.log('Bound assets for', assetName, ':', boundForAsset);
      console.log('Already bound count:', boundForAsset.length);
      
      // Store bound assets for display
      setBoundAssetsList(boundForAsset);
      
      // Set quantity information
      const bound = boundForAsset.length;
      const remaining = totalQuantity - bound;
      
      setTotalQty(totalQuantity);
      setBoundQty(bound);
      setRemainingQty(remaining);
      setCurrentBindingIndex(0);
      
      if (remaining > 0) {
        // Generate only ONE binding row to start
        const timestamp = Date.now();
        const serialNo = `SYS-${assetName.substring(0, 3).toUpperCase()}-${String(bound + 1).padStart(4, '0')}`;
        const generatedQrCode = encryptSerialNo(serialNo);
        const decryptedQrCode = decryptQrCode(generatedQrCode);
        
        // Get assetId from mapping
        const assetId = assetMapping.get(assetName) || 0;
        console.log('Asset ID from mapping:', assetId);
        console.log('Generated Serial No:', serialNo);
        console.log('Generated QR Code (Encrypted):', generatedQrCode);
        console.log('Decrypted QR Code (Verification):', decryptedQrCode);
        console.log('Encryption Valid:', serialNo === decryptedQrCode);
        
        const firstBinding: RFIDBinding = {
          assetTaggingId: 0,
          assetId: assetId,
          assetName: assetName,
          serialNo: serialNo,
          rfidNo: '',
          qrCode: generatedQrCode,
          status: 0,
          assetStatus: 'Active',
          uniqueKey: `binding-${timestamp}-0`,
        };
        console.log('Generated First Binding:', firstBinding);
        setBindings([firstBinding]);
      } else {
        setError('All assets have been bound. No remaining quantity.');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err: any) {
      console.error('Failed to fetch asset tagging list:', err);
      // If API fails, continue with bound = 0
      const bound = 0;
      const remaining = totalQuantity - bound;
      
      setTotalQty(totalQuantity);
      setBoundQty(bound);
      setRemainingQty(remaining);
      setCurrentBindingIndex(0);
      
      generateFirstBinding(assetName, bound);
    }
  };

  const generateFirstBinding = (assetName: string, bound: number) => {
    const timestamp = Date.now();
    const serialNo = `SYS-${assetName.substring(0, 3).toUpperCase()}-${String(bound + 1).padStart(4, '0')}`;
    const generatedQrCode = encryptSerialNo(serialNo);
    const assetId = assetMapping.get(assetName) || 0;
    
    const firstBinding: RFIDBinding = {
      assetTaggingId: 0,
      assetId: assetId,
      assetName: assetName,
      serialNo: serialNo,
      rfidNo: '',
      qrCode: generatedQrCode,
      status: 0,
      assetStatus: 'Active',
      uniqueKey: `binding-${timestamp}-0`,
    };
    setBindings([firstBinding]);
  };

  const handleBindingChange = (
    index: number,
    field: keyof RFIDBinding,
    value: string | number
  ) => {
    const updatedBindings = [...bindings];
    if (field === 'assetTaggingId' || field === 'assetId' || field === 'status') {
      updatedBindings[index][field] = Number(value);
    } else if (field !== 'uniqueKey') {
      updatedBindings[index][field] = value as string;
      // Auto-generate QR code when serial number changes
      if (field === 'serialNo') {
        const newQrCode = encryptSerialNo(value as string);
        const decryptedQrCode = decryptQrCode(newQrCode);
        console.log('Serial No changed to:', value);
        console.log('New QR Code (Encrypted):', newQrCode);
        console.log('Decrypted QR Code (Verification):', decryptedQrCode);
        console.log('Encryption Valid:', value === decryptedQrCode);
        updatedBindings[index].qrCode = newQrCode;
      }
    }
    setBindings(updatedBindings);
  };


  const handleImportRFID = () => {
    // Implement bulk RFID import functionality
    alert('Import RFID functionality - Connect to RFID reader for bulk import');
  };


  const handleConfirmBinding = async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    // Validate current binding
    const currentBinding = bindings[0];
    if (!currentBinding.serialNo || (!currentBinding.rfidNo && !currentBinding.qrCode)) {
      setError('Please fill in all required fields (Serial No and RFID/QR Code)');
      setLoading(false);
      return;
    }

    try {
      // Confirm current binding (status = 1)
      const { uniqueKey, ...bindingData } = currentBinding;
      const confirmedBinding = {
        ...bindingData,
        status: 1,
      };
      
      console.log('Sending binding data to API:', confirmedBinding);
      await bindRFID(confirmedBinding);

      setSuccessMessage('RFID Binding confirmed successfully!');
      
      // Update quantities
      const newBoundQty = boundQty + 1;
      const newRemainingQty = totalQty - newBoundQty;
      setBoundQty(newBoundQty);
      setRemainingQty(newRemainingQty);
      
      // Check if more bindings are needed
      if (newRemainingQty > 0) {
        // Generate next binding row
        setTimeout(() => {
          const timestamp = Date.now();
          const nextIndex = currentBindingIndex + 1;
          const serialNo = `SYS-${selectedAsset?.assetName.substring(0, 3).toUpperCase()}-${String(newBoundQty + 1).padStart(4, '0')}`;
          const generatedQrCode = encryptSerialNo(serialNo);
          const assetId = assetMapping.get(selectedAsset?.assetName || '') || 0;
          console.log('Next Asset ID from mapping:', assetId);
          console.log('Next Serial No:', serialNo);
          console.log('Next QR Code:', generatedQrCode);
          
          const nextBinding: RFIDBinding = {
            assetTaggingId: 0,
            assetId: assetId,
            assetName: selectedAsset?.assetName || '',
            serialNo: serialNo,
            rfidNo: '',
            qrCode: generatedQrCode,
            status: 0,
            assetStatus: 'Active',
            uniqueKey: `binding-${timestamp}-${nextIndex}`,
          };
          console.log('Next Binding:', nextBinding);
          setBindings([nextBinding]);
          setCurrentBindingIndex(nextIndex);
          setSuccessMessage('');
        }, 1000);
      } else {
        // All bindings complete, reset form
        setTimeout(() => {
          setSelectedAsset(null);
          setTotalQty(0);
          setBoundQty(0);
          setRemainingQty(0);
          setCurrentBindingIndex(0);
          setBindings([
            {
              assetTaggingId: 0,
              assetId: 0,
              assetName: '',
              serialNo: '',
              rfidNo: '',
              qrCode: '',
              status: 0,
              assetStatus: 'Active',
              uniqueKey: `binding-${Date.now()}-0`,
            },
          ]);
          setSuccessMessage('All bindings completed!');
          setTimeout(() => setSuccessMessage(''), 2000);
        }, 1000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to confirm binding');
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status: number) => {
    switch (status) {
      case 0:
        return 'Pending';
      case 1:
        return 'Completed';
      default:
        return 'Pending';
    }
  };

  const getStatusClass = (status: number) => {
    switch (status) {
      case 0:
        return 'status-pending';
      case 1:
        return 'status-completed';
      default:
        return 'status-pending';
    }
  };

  return (
    <div className="rfid-binding-container">
      <div className="rfid-binding-header">
        <h1>RFID Binding</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      <div className="rfid-binding-content">
        {/* Asset Selection Section */}
        <div className="grn-reference-section">
          <h3 className="section-title">Asset Selection</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="asset">
                Asset <span className="required">*</span>
              </label>
              <select
                id="asset"
                value={selectedAsset?.assetName || ''}
                onChange={handleAssetSelect}
                className="form-control"
              >
                <option value="">Select Asset</option>
                {Array.from(new Set(grns.flatMap((grn) => 
                  grn.lineItems?.map((item) => item.assetName) || []
                ))).map((assetName) => (
                  <option key={assetName} value={assetName}>
                    {assetName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedAsset && (
            <div className="form-row" style={{ marginTop: '15px' }}>
              <div className="form-group">
                <label>Total Quantity</label>
                <input
                  type="text"
                  value={totalQty}
                  disabled
                  className="form-control"
                  style={{ fontWeight: 'bold', backgroundColor: '#e3f2fd' }}
                />
              </div>
              <div className="form-group">
                <label>Already Bound</label>
                <input
                  type="text"
                  value={boundQty}
                  disabled
                  className="form-control"
                  style={{ fontWeight: 'bold', backgroundColor: '#c8e6c9' }}
                />
              </div>
              <div className="form-group">
                <label>Remaining Quantity</label>
                <input
                  type="text"
                  value={remainingQty}
                  disabled
                  className="form-control"
                  style={{ fontWeight: 'bold', backgroundColor: '#fff9c4' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Serial & RFID Binding Section */}
        <div className="serial-rfid-binding-section">
          <h3 className="section-title">Serial & RFID Binding</h3>
          <div className="binding-table-container">
            <table className="binding-table">
              <thead>
                <tr>
                  <th>Sr No</th>
                  <th>System Serial No</th>
                  <th>Vendor Serial No</th>
                  <th>RFID Tag</th>
                  <th>QR Code</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bindings.map((binding, index) => (
                  <tr key={binding.uniqueKey}>
                    <td>{index + 1}</td>
                    <td>
                      <input
                        type="text"
                        value={binding.serialNo}
                        onChange={(e) =>
                          handleBindingChange(index, 'serialNo', e.target.value)
                        }
                        className="table-input"
                        placeholder="System Serial"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={binding.serialNo.replace('SYS-', 'VND-')}
                        className="table-input"
                        placeholder="Vendor Serial"
                        disabled
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={binding.rfidNo}
                        onChange={(e) =>
                          handleBindingChange(index, 'rfidNo', e.target.value)
                        }
                        className="table-input"
                        placeholder="Scan RFID"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={binding.qrCode}
                        className="table-input"
                        placeholder="Auto Generated"
                        disabled
                        title={`Encrypted QR Code\nDecrypted: ${decryptQrCode(binding.qrCode)}`}
                        style={{ backgroundColor: '#f5f5f5', cursor: 'help' }}
                      />
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusClass(binding.status)}`}>
                        {getStatusText(binding.status)}
                      </span>
                    </td>
                    <td>
                      {remainingQty > 0 && (
                        <span style={{ color: '#666', fontSize: '12px' }}>
                          {boundQty + 1} of {totalQty}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          

          <div className="binding-actions">
            <button
              type="button"
              className="btn-import"
              onClick={handleImportRFID}
              disabled={loading}
            >
              Import RFID
            </button>
            
            <button
              type="button"
              className="btn-confirm"
              onClick={handleConfirmBinding}
              disabled={loading || !selectedAsset}
            >
              {loading ? 'Processing...' : 'Confirm Binding'}
            </button>
          </div>
        </div>

        {/* Already Bound Assets Section */}
        {selectedAsset && boundAssetsList.length > 0 && (
          <div className="bound-assets-section" style={{ marginTop: '30px' }}>
            <h3 className="section-title">Already Bound Assets - {selectedAsset.assetName}</h3>
            <div className="binding-table-container">
              <table className="binding-table">
                <thead>
                  <tr>
                    <th>Sr No</th>
                    <th>Asset Name</th>
                    <th>System Serial No</th>
                    <th>RFID Tag</th>
                    <th>QR Code</th>
                    <th>Status</th>
                    <th>Asset Status</th>
                  </tr>
                </thead>
                <tbody>
                  {boundAssetsList.map((item, index) => (
                    <tr key={item.assetTaggingId || index}>
                      <td>{index + 1}</td>
                      <td>{item.assetName}</td>
                      <td>{item.serialNo}</td>
                      <td>{item.rfidNo || 'N/A'}</td>
                      <td>
                        <span 
                          title={`Encrypted: ${item.qrCode}\nDecrypted: ${decryptQrCode(item.qrCode)}`}
                          style={{ cursor: 'help' }}
                        >
                          {item.qrCode ? `${item.qrCode.substring(0, 20)}...` : 'N/A'}
                        </span>
                      </td>
                      <td>
                        <span className="status-badge status-completed">
                          {getStatusText(item.status)}
                        </span>
                      </td>
                      <td>{item.assetStatus || 'Active'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '10px', color: '#666', fontSize: '14px' }}>
              Total Bound: {boundAssetsList.length} / {totalQty}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RFIDbinding;