import React, { useState, useEffect } from 'react';
import { emergencyAPI } from '../../services/api';

const EmergencyContacts = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    contactName: '',
    phoneNumber: '',
    relationship: '',
    email: '',
    notes: ''
  });

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const response = await emergencyAPI.getContacts();
      if (response.success) {
        setContacts(response.data.contacts);
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await emergencyAPI.addContact(formData);
      setFormData({ contactName: '', phoneNumber: '', relationship: '', email: '', notes: '' });
      setShowForm(false);
      loadContacts();
    } catch (error) {
      alert('Failed to add contact');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this contact?')) {
      try {
        await emergencyAPI.deleteContact(id);
        loadContacts();
      } catch (error) {
        alert('Failed to delete contact');
      }
    }
  };

  if (loading) return <div>Loading contacts...</div>;

  return (
    <div className="emergency-contacts">
      <div className="section-header">
        <h3>Emergency Contacts</h3>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          {showForm ? 'Cancel' : 'Add Contact'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="contact-form">
          <input
            type="text"
            placeholder="Contact Name"
            value={formData.contactName}
            onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
            required
          />
          <input
            type="tel"
            placeholder="Phone Number"
            value={formData.phoneNumber}
            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Relationship (e.g., Mother, Friend)"
            value={formData.relationship}
            onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
            required
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <textarea
            placeholder="Notes (optional)"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
          <button type="submit" className="btn btn-primary">Save Contact</button>
        </form>
      )}

      <div className="contacts-list">
        {contacts.length === 0 ? (
          <p>No emergency contacts added yet.</p>
        ) : (
          contacts.map((contact, index) => (
            <div key={contact.id} className="contact-card">
              <div className="contact-priority">#{index + 1}</div>
              <div className="contact-info">
                <h4>{contact.contactName}</h4>
                <p>{contact.phoneNumber}</p>
                <p className="relationship">{contact.relationship}</p>
                {contact.email && <p className="email">{contact.email}</p>}
              </div>
              <button onClick={() => handleDelete(contact.id)} className="btn-delete">Delete</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EmergencyContacts;