

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Reconciliation.css';

interface ReconciliationItem {
  assetReconciliationId: number;
  assetId: number;
  rfidNo: string;
  qrCode: string;
  status: string;
  reconciliationDate: string;
  reconciliationStatus: number;
  assetCondition: string;
  areaId: number;
  areaName: string;
}


const Reconciliation: React.FC = () => {
  const [data, setData] = useState<ReconciliationItem[]>([]);
  const [filtered, setFiltered] = useState<ReconciliationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [area, setArea] = useState('');
  const [asset, setAsset] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('http://192.168.1.101:7878/api/AssetReconciliation/GetReconciliationList');
        setData(response.data);
        setFiltered(response.data);
      } catch (err: any) {
        setError('Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Get unique area and asset names for dropdowns
  const areaOptions = Array.from(new Set(data.map(d => d.areaName)));
  const assetOptions = Array.from(new Set(data.map(d => d.qrCode)));

  // Filter handler
  useEffect(() => {
    let filteredData = data;
    if (fromDate) {
      filteredData = filteredData.filter(d => new Date(d.reconciliationDate) >= new Date(fromDate));
    }
    if (toDate) {
      filteredData = filteredData.filter(d => new Date(d.reconciliationDate) <= new Date(toDate));
    }
    if (area && area !== 'All Areas') {
      filteredData = filteredData.filter(d => d.areaName === area);
    }
    if (asset && asset !== 'All Assets') {
      filteredData = filteredData.filter(d => d.qrCode === asset);
    }
    setFiltered(filteredData);
  }, [fromDate, toDate, area, asset, data]);

  return (
    <div className="reconciliation-container">
      <div className="reconciliation-header">
        <h2>Reconciliation Report</h2>
      </div>
      <div className="reconciliation-content">
        <div className="filter-section">
          <div className="filter-group">
            <label>From Date</label>
            <input
              type="date"
              className="filter-control"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>To Date</label>
            <input
              type="date"
              className="filter-control"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Area</label>
            <select
              className="filter-control"
              value={area}
              onChange={e => setArea(e.target.value)}
            >
              <option>All Areas</option>
              {areaOptions.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Asset</label>
            <select
              className="filter-control"
              value={asset}
              onChange={e => setAsset(e.target.value)}
            >
              <option>All Assets</option>
              {assetOptions.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-container">
          {loading ? (
            <p>Loading...</p>
          ) : error ? (
            <p style={{ color: 'red' }}>{error}</p>
          ) : (
            <table className="reconciliation-table">
              <thead>
                <tr>
                  <th>Sr.No</th>
                  <th>Asset</th>
                  <th>Area</th>
                  <th>RFID No</th>
                  <th>Date</th>
                  <th>Condition</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => (
                  <tr key={item.assetReconciliationId}>
                    <td>{idx + 1}</td>
                    <td>{item.qrCode}</td>
                    <td>{item.areaName}</td>
                    <td>{item.rfidNo}</td>
                    <td>{item.reconciliationDate}</td>
                    <td>{item.assetCondition}</td>
                    <td>{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reconciliation;