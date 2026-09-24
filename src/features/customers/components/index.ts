/**
 * Customer Components Barrel Export
 */

// Main Form & Sections
export { CustomerForm } from './CustomerForm';
export { CustomerBasicInfoSection } from './CustomerBasicInfoSection';
export { CustomerAddressSection } from './CustomerAddressSection';
export { CustomerContactSection } from './CustomerContactSection';
export { CustomerTaxSection } from './CustomerTaxSection';
export { CustomerCreditSection } from './CustomerCreditSection';
export { CustomerStatusSection } from './CustomerStatusSection';

// Table & Columns
export { CustomersTable } from './CustomersTable';
export { getCustomersTableColumns } from './CustomersTableColumns';

// Drawers/Modals
export { CreateCustomerDrawer } from './CreateCustomerDrawer';
export { ViewCustomerDrawer } from './ViewCustomerDrawer';
export { EditCustomerDrawer } from './EditCustomerDrawer';

// Contacts
export { CustomerContactForm, contactToFormValues } from './CustomerContactForm';
export { CustomerContactsList } from './CustomerContactsList';

// Detail View
export { CustomerDetailView } from './CustomerDetailView';
