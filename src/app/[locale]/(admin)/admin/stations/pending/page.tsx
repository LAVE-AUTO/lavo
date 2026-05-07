import { redirect } from 'next/navigation';

/* Redirect to the main stations list - both pages show pending stations */
export default function AdminPendingStationsPage() {
  redirect('/admin/stations');
}
