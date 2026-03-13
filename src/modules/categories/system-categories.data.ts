import { TransactionType } from '../../generated/prisma/client';

export interface SystemCategorySeedData {
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  sortOrder: number;
  children?: Omit<SystemCategorySeedData, 'children' | 'type'>[];
}

export const SYSTEM_CATEGORIES: SystemCategorySeedData[] = [
  {
    name: 'Food & Drinks',
    type: TransactionType.EXPENSE,
    icon: 'utensils',
    color: '#FF6B6B',
    sortOrder: 0,
    children: [
      {
        name: 'Groceries',
        icon: 'shopping-cart',
        color: '#FF6B6B',
        sortOrder: 0,
      },
      { name: 'Restaurants', icon: 'store', color: '#FF6B6B', sortOrder: 1 },
      { name: 'Coffee & Bars', icon: 'coffee', color: '#FF6B6B', sortOrder: 2 },
      { name: 'Delivery', icon: 'truck', color: '#FF6B6B', sortOrder: 3 },
    ],
  },
  {
    name: 'Transportation',
    type: TransactionType.EXPENSE,
    icon: 'car',
    color: '#4ECDC4',
    sortOrder: 1,
    children: [
      { name: 'Fuel', icon: 'fuel-pump', color: '#4ECDC4', sortOrder: 0 },
      { name: 'Public Transit', icon: 'bus', color: '#4ECDC4', sortOrder: 1 },
      {
        name: 'Taxi & Rideshare',
        icon: 'taxi',
        color: '#4ECDC4',
        sortOrder: 2,
      },
      { name: 'Parking', icon: 'parking', color: '#4ECDC4', sortOrder: 3 },
      { name: 'Maintenance', icon: 'wrench', color: '#4ECDC4', sortOrder: 4 },
    ],
  },
  {
    name: 'Housing',
    type: TransactionType.EXPENSE,
    icon: 'home',
    color: '#45B7D1',
    sortOrder: 2,
    children: [
      { name: 'Rent', icon: 'key', color: '#45B7D1', sortOrder: 0 },
      { name: 'Mortgage', icon: 'building', color: '#45B7D1', sortOrder: 1 },
      { name: 'Utilities', icon: 'zap', color: '#45B7D1', sortOrder: 2 },
      { name: 'Insurance', icon: 'shield', color: '#45B7D1', sortOrder: 3 },
      { name: 'Repairs', icon: 'tool', color: '#45B7D1', sortOrder: 4 },
    ],
  },
  {
    name: 'Shopping',
    type: TransactionType.EXPENSE,
    icon: 'shopping-bag',
    color: '#F7DC6F',
    sortOrder: 3,
    children: [
      { name: 'Clothing', icon: 'shirt', color: '#F7DC6F', sortOrder: 0 },
      {
        name: 'Electronics',
        icon: 'smartphone',
        color: '#F7DC6F',
        sortOrder: 1,
      },
      { name: 'Home & Garden', icon: 'flower', color: '#F7DC6F', sortOrder: 2 },
      { name: 'Gifts', icon: 'gift', color: '#F7DC6F', sortOrder: 3 },
    ],
  },
  {
    name: 'Entertainment',
    type: TransactionType.EXPENSE,
    icon: 'film',
    color: '#BB8FCE',
    sortOrder: 4,
    children: [
      { name: 'Movies & Shows', icon: 'tv', color: '#BB8FCE', sortOrder: 0 },
      { name: 'Games', icon: 'gamepad', color: '#BB8FCE', sortOrder: 1 },
      { name: 'Books & Music', icon: 'book', color: '#BB8FCE', sortOrder: 2 },
      {
        name: 'Events & Concerts',
        icon: 'ticket',
        color: '#BB8FCE',
        sortOrder: 3,
      },
    ],
  },
  {
    name: 'Health',
    type: TransactionType.EXPENSE,
    icon: 'heart',
    color: '#E74C3C',
    sortOrder: 5,
    children: [
      {
        name: 'Doctor & Dentist',
        icon: 'stethoscope',
        color: '#E74C3C',
        sortOrder: 0,
      },
      { name: 'Pharmacy', icon: 'pill', color: '#E74C3C', sortOrder: 1 },
      {
        name: 'Gym & Sports',
        icon: 'dumbbell',
        color: '#E74C3C',
        sortOrder: 2,
      },
      {
        name: 'Health Insurance',
        icon: 'shield-check',
        color: '#E74C3C',
        sortOrder: 3,
      },
    ],
  },
  {
    name: 'Education',
    type: TransactionType.EXPENSE,
    icon: 'graduation-cap',
    color: '#3498DB',
    sortOrder: 6,
    children: [
      { name: 'Tuition', icon: 'school', color: '#3498DB', sortOrder: 0 },
      {
        name: 'Courses & Training',
        icon: 'book-open',
        color: '#3498DB',
        sortOrder: 1,
      },
      {
        name: 'Books & Materials',
        icon: 'bookmark',
        color: '#3498DB',
        sortOrder: 2,
      },
    ],
  },
  {
    name: 'Subscriptions',
    type: TransactionType.EXPENSE,
    icon: 'repeat',
    color: '#1ABC9C',
    sortOrder: 7,
    children: [
      {
        name: 'Streaming',
        icon: 'play-circle',
        color: '#1ABC9C',
        sortOrder: 0,
      },
      { name: 'Software', icon: 'code', color: '#1ABC9C', sortOrder: 1 },
      { name: 'Memberships', icon: 'users', color: '#1ABC9C', sortOrder: 2 },
    ],
  },
  {
    name: 'Personal Care',
    type: TransactionType.EXPENSE,
    icon: 'smile',
    color: '#F39C12',
    sortOrder: 8,
    children: [
      {
        name: 'Haircut & Beauty',
        icon: 'scissors',
        color: '#F39C12',
        sortOrder: 0,
      },
      { name: 'Skincare', icon: 'droplet', color: '#F39C12', sortOrder: 1 },
    ],
  },
  {
    name: 'Travel',
    type: TransactionType.EXPENSE,
    icon: 'plane',
    color: '#2ECC71',
    sortOrder: 9,
    children: [
      {
        name: 'Flights',
        icon: 'plane-takeoff',
        color: '#2ECC71',
        sortOrder: 0,
      },
      { name: 'Hotels', icon: 'bed', color: '#2ECC71', sortOrder: 1 },
      { name: 'Activities', icon: 'map-pin', color: '#2ECC71', sortOrder: 2 },
    ],
  },
  {
    name: 'Taxes & Fees',
    type: TransactionType.EXPENSE,
    icon: 'file-text',
    color: '#95A5A6',
    sortOrder: 10,
    children: [
      { name: 'Income Tax', icon: 'percent', color: '#95A5A6', sortOrder: 0 },
      {
        name: 'Bank Fees',
        icon: 'credit-card',
        color: '#95A5A6',
        sortOrder: 1,
      },
      {
        name: 'Government Fees',
        icon: 'landmark',
        color: '#95A5A6',
        sortOrder: 2,
      },
    ],
  },
  {
    name: 'Pets',
    type: TransactionType.EXPENSE,
    icon: 'paw-print',
    color: '#D35400',
    sortOrder: 11,
    children: [
      { name: 'Pet Food', icon: 'bone', color: '#D35400', sortOrder: 0 },
      {
        name: 'Veterinary',
        icon: 'stethoscope',
        color: '#D35400',
        sortOrder: 1,
      },
    ],
  },
  {
    name: 'Other Expense',
    type: TransactionType.EXPENSE,
    icon: 'more-horizontal',
    color: '#7F8C8D',
    sortOrder: 99,
  },
  {
    name: 'Salary',
    type: TransactionType.INCOME,
    icon: 'briefcase',
    color: '#27AE60',
    sortOrder: 0,
    children: [
      { name: 'Main Job', icon: 'building', color: '#27AE60', sortOrder: 0 },
      { name: 'Bonus', icon: 'award', color: '#27AE60', sortOrder: 1 },
      { name: 'Overtime', icon: 'clock', color: '#27AE60', sortOrder: 2 },
    ],
  },
  {
    name: 'Freelance',
    type: TransactionType.INCOME,
    icon: 'laptop',
    color: '#2980B9',
    sortOrder: 1,
  },
  {
    name: 'Investments',
    type: TransactionType.INCOME,
    icon: 'trending-up',
    color: '#8E44AD',
    sortOrder: 2,
    children: [
      { name: 'Dividends', icon: 'bar-chart', color: '#8E44AD', sortOrder: 0 },
      { name: 'Interest', icon: 'percent', color: '#8E44AD', sortOrder: 1 },
      {
        name: 'Capital Gains',
        icon: 'arrow-up-right',
        color: '#8E44AD',
        sortOrder: 2,
      },
    ],
  },
  {
    name: 'Rental Income',
    type: TransactionType.INCOME,
    icon: 'home',
    color: '#16A085',
    sortOrder: 3,
  },
  {
    name: 'Gifts Received',
    type: TransactionType.INCOME,
    icon: 'gift',
    color: '#E67E22',
    sortOrder: 4,
  },
  {
    name: 'Refunds',
    type: TransactionType.INCOME,
    icon: 'rotate-ccw',
    color: '#3498DB',
    sortOrder: 5,
  },
  {
    name: 'Other Income',
    type: TransactionType.INCOME,
    icon: 'more-horizontal',
    color: '#7F8C8D',
    sortOrder: 99,
  },
  {
    name: 'Account Transfer',
    type: TransactionType.TRANSFER,
    icon: 'arrow-right-left',
    color: '#9B59B6',
    sortOrder: 0,
  },
  {
    name: 'Investment Transfer',
    type: TransactionType.TRANSFER,
    icon: 'trending-up',
    color: '#8E44AD',
    sortOrder: 1,
  },
  {
    name: 'Savings Transfer',
    type: TransactionType.TRANSFER,
    icon: 'piggy-bank',
    color: '#1ABC9C',
    sortOrder: 2,
  },
];
