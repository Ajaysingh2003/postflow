import { Button } from '@/components/ui/button'
import React from 'react'

function CtaSection() {
  return (
    
        <div className='side_2 p-1   justify-centezr mt-5 flex items-center flex-col md:flex-row gap-5'>
          <Button className=' h-9 capitalize secondary-btn w-full md:w-45 cursor-pointer border-[0.5px] border-[#0000009b] rounded-lg' variant={"ghost"}>Sign up</Button>
          <Button variant={"default"} className='capitalize h-9 px-8 w-full md:w-45 rounded-md primary-btn font-bold  cursor-pointer text-white '>Start Free trial</Button>
        </div>
  )
}

export default CtaSection