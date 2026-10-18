export type Customer = {
  id: string;
  full_name: string;
  phone: string;
  customer_code?: string;
  advisor_name?: string;
  agency?: string;
  survey_rating?: number;
  survey_interest?: string;
  survey_feedback?: string;
  consent?: boolean;
  eligible?: boolean;
  created_at: string;
  event_name?: string;
  event_date?: string;
  event_time?: string;
  appointment_date?: string;
};
export type Prize = { id: string; name: string; quantity: number; won: number; active: boolean };
export type Winner = { id: string; customer_id: string; full_name: string; phone: string; advisor_name: string; prize_name: string; won_at: string; customer_code?: string };
export const defaultPrizes: Prize[] = [
  {id:"p1",name:"Giải Đặc Biệt",quantity:1,won:0,active:true},
  {id:"p2",name:"Giải Nhất",quantity:2,won:0,active:true},
  {id:"p3",name:"Giải Nhì",quantity:3,won:0,active:true},
  {id:"p4",name:"Giải Ba",quantity:5,won:0,active:true},
  {id:"p5",name:"Giải Khuyến Khích",quantity:10,won:0,active:true}
];