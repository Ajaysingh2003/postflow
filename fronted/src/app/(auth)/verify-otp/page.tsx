// import VerifyOTPView from '@/modules/auth/view/VerifyOTPView'
import VerifyOTPView from '@/modules/user/view/VerifyOTPView';
import React from 'react'

type PageProps = {
  searchParams: Promise<{
    email?:string;
    token?: string;
  }>;
};


async function page({searchParams}:PageProps) {

    const {email, token } =await searchParams;

  return (
    <div className='w-full h-full'>
        <VerifyOTPView email={email ?? ""} token={token ?? ""} />
    </div>
  )
}

export default page
