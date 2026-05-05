/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CouponStatus = 'pending' | 'verified' | 'expired';

export interface Settings {
  mosqueName: string;
  mosqueAddress: string;
  maxCoupons: number;
  expiryMinutes: number;
  mosqueLat?: number;
  mosqueLng?: number;
  loginPassword?: string;
}

export interface Coupon {
  id: string;
  queueNumber: number;
  name: string;
  address: string;
  status: CouponStatus;
  createdAt: any; // Firestore Timestamp
  expiresAt: any; // Firestore Timestamp
  verifiedAt?: any; // Firestore Timestamp
  notification?: string;
}

export interface CouponCounter {
  count: number;
}

export interface AdminUser {
  id: string;
  email?: string;
  phoneNumber?: string;
  role: 'super_admin' | 'operator';
  createdAt: any;
}

export interface AdminInvitation {
  id: string;
  email: string;
  role: 'super_admin' | 'operator';
  invitedBy: string;
  createdAt: any;
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  adminEmail: string;
  timestamp: any;
}
